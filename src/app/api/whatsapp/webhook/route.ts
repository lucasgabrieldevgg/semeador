import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCapitulo } from "@/data/capitulos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* ============================================================
 * BOT DE WHATSAPP VIA Z-API (plano B / alternativa à Zapia Max)
 * ------------------------------------------------------------
 * Fluxo:
 *  1. Adalberto manda mensagem no WhatsApp;
 *  2. Z-API chama este webhook (configure em: Z-API > Webhooks >
 *     "Ao receber" / ReceivedCallback apontando para
 *     https://exodo-quest.vercel.app/api/whatsapp/webhook);
 *  3. A IA (ChatAnywhere/GPT) interpreta a intenção;
 *  4. Buscamos os dados no Supabase / gravamos mensagem;
 *  5. Respondemos via Z-API send-text.
 *
 * Variáveis necessárias (Vercel):
 *  ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN
 *  ADMIN_PHONE  -> número do Adalberto (ex: 5565999998888)
 *                  Só ele pode usar o bot (segurança).
 * ============================================================ */

/**
 * Compara números de WhatsApp brasileiros tolerando o NONO DÍGITO:
 * 556699539814 (sem 9) e 5566999539814 (com 9) são o MESMO número.
 * Estratégia: os últimos 8 dígitos + DDD devem bater.
 */
function mesmoNumero(a: string, b: string): boolean {
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (!da || !db) return false;
  if (da === db) return true;
  // últimos 8 dígitos (número local sem o nono dígito)
  if (da.slice(-8) !== db.slice(-8)) return false;
  // DDD: pega os 2 dígitos após o código do país (55), com ou sem nono dígito
  const ddd = (n: string) => {
    const semPais = n.startsWith("55") && n.length >= 12 ? n.slice(2) : n;
    return semPais.slice(0, 2);
  };
  return ddd(da) === ddd(db);
}

interface IntencaoIA {
  acao: "consulta_status" | "enviar_mensagem" | "conversa";
  nome?: string;
  capitulo?: number | null;
  mensagem?: string;
  resposta_livre?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // 🔍 LOG DE DEPURAÇÃO compacto: campos-chave para diagnóstico
    console.log(
      `[zapi-debug] type=${body?.type} phone=${body?.phone} fromMe=${body?.fromMe} ` +
        `momment=${body?.momment} chatName=${JSON.stringify(body?.chatName ?? "")} ` +
        `text=${JSON.stringify(body?.text ?? null)} keys=${Object.keys(body || {}).join(",")}`
    );

    // Formato do ReceivedCallback da Z-API
    const fromMe: boolean = body?.fromMe ?? false;
    const phone: string = String(body?.phone ?? "");
    const textoBruto: string =
      body?.text?.message ?? body?.message?.text ?? body?.body ?? "";
    let texto = String(textoBruto).trim();

    if (!texto) {
      return NextResponse.json({ ok: true, ignorado: "sem texto" });
    }

    const adminPhone = (process.env.ADMIN_PHONE ?? "").replace(/\D/g, "");
    const remetente = phone.replace(/\D/g, "");

    /* ------------------------------------------------------------
     * REGRAS DE QUEM O BOT ATENDE (sempre com prefixo "!"):
     * 1. Mensagens que EU (dono do número) envio em QUALQUER chat,
     *    começando com "!" => comando; resposta no MESMO chat.
     * 2. Mensagens RECEBIDAS do ADMIN_PHONE (Adalberto) na DM,
     *    começando com "!" => comando; resposta para ele.
     * 3. GRUPO DE RELATÓRIOS (REPORT_GROUP_ID): comandos "!" de
     *    qualquer participante => resposta no próprio grupo.
     *    (Outros grupos continuam ignorados.)
     * 4. Qualquer outro remetente/chat: ignorado.
     * ------------------------------------------------------------ */
    const reportGroup = (process.env.REPORT_GROUP_ID ?? "").trim();
    const ehGrupoRelatorios =
      reportGroup && phone.replace(/\D/g, "") === reportGroup.replace(/\D/g, "");

    if (!texto.startsWith("!")) {
      return NextResponse.json({ ok: true, ignorado: "sem prefixo !" });
    }

    if (fromMe || ehGrupoRelatorios) {
      // eu em qualquer chat, ou qualquer participante do grupo de relatórios
    } else {
      if (!adminPhone) {
        return NextResponse.json({ ok: true, ignorado: "ADMIN_PHONE não configurado — bot desativado" });
      }
      if (!mesmoNumero(remetente, adminPhone)) {
        return NextResponse.json({ ok: true, ignorado: `remetente não autorizado (${remetente})` });
      }
    }

    texto = texto.slice(1).trim(); // remove o "!"
    if (!texto) return NextResponse.json({ ok: true, ignorado: "comando vazio" });

    // 1) Comandos diretos (sem IA): !comandos, !erros <nome>, !status <nome>
    let resposta: string | null = await comandoDireto(texto);

    // 2) Se não for comando direto, a IA interpreta a intenção
    if (resposta === null) {
      const intencao = await interpretarMensagem(texto);
      switch (intencao.acao) {
        case "consulta_status":
          resposta = await consultarStatus(intencao.nome ?? "", intencao.capitulo ?? null);
          break;
        case "enviar_mensagem":
          resposta = await gravarMensagemAluno(intencao.nome ?? "todos", intencao.mensagem ?? "");
          break;
        default:
          resposta = intencao.resposta_livre
            ? intencao.resposta_livre + SUGESTAO_COMANDOS
            : TEXTO_AJUDA;
      }
    }

    // 3) Envia a resposta pelo WhatsApp via Z-API
    await enviarTextoZapi(phone, resposta);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[api/whatsapp/webhook]", e);
    return NextResponse.json({ ok: false, erro: String(e?.message ?? e) }, { status: 200 });
    // status 200 mesmo em erro para a Z-API não reenfileirar indefinidamente
  }
}

/* ----------------- Comandos diretos ----------------- */
const SUGESTAO_COMANDOS = "\n\n💡 Digite *!comandos* para ver tudo que eu faço.";

const SITE_URL = "https://exodo-quest.vercel.app";

const TEXTO_AJUDA =
  "🤖 *Tutor Êxodo Quest — Comandos*\n\n" +
  "👥 *!alunos* — lista todos os alunos cadastrados\n\n" +
  "📊 *!status <aluno>* — desempenho geral do aluno\n" +
  "   _ex: !status Lucas_\n\n" +
  "📊 *!status <aluno> cap <n>* — desempenho em um capítulo\n" +
  "   _ex: !status Lucas cap 3_\n\n" +
  "❌ *!erros <aluno>* — questões erradas: o que marcou e a resposta certa\n" +
  "   _ex: !erros Lucas_\n\n" +
  "❌ *!erros <aluno> cap <n>* — erros de um capítulo específico\n" +
  "   _ex: !erros Lucas cap 3_\n\n" +
  "📨 *!avise <aluno>: <mensagem>* — manda aviso para o app do aluno\n" +
  "   _ex: !avise Lucas: revise o capítulo 3_\n\n" +
  "📢 *!avise todos: <mensagem>* — aviso para todos os alunos\n\n" +
  "🌐 *!site* — link do app\n\n" +
  "📚 *!comandos* — esta lista\n\n" +
  "Você também pode escrever naturalmente, ex:\n" +
  "_!como o Lucas foi no capítulo 3?_";

/**
 * Trata comandos com sintaxe fixa. Retorna null se o texto não for
 * um comando direto (aí cai na interpretação por IA).
 * Nomes de aluno são tratados de forma case-insensitive.
 */
async function comandoDireto(texto: string): Promise<string | null> {
  const t = texto.trim();

  // !comandos / !ajuda / !help
  if (/^(comandos|ajuda|help|menu)\b/i.test(t)) return TEXTO_AJUDA;

  // !site / !link / !app
  if (/^(site|link|app)\b/i.test(t)) {
    return (
      `🌐 *Êxodo Quest*\n${SITE_URL}\n\n` +
      `É só abrir, digitar o nome e começar a estudar! 📖🔥` +
      SUGESTAO_COMANDOS
    );
  }

  // !alunos / !usuarios / !lista
  if (/^(alunos|usuarios|usuários|lista)\b/i.test(t)) return listarAlunos();

  // !erros <nome> [cap N]
  const mErros = t.match(/^erros\s+(.+?)(?:\s+cap(?:[ií]tulo)?\.?\s*(\d{1,2}))?\s*$/i);
  if (mErros) {
    return listarErros(mErros[1].trim(), mErros[2] ? Number(mErros[2]) : null);
  }

  // !status <nome> [cap N]
  const mStatus = t.match(/^status\s+(?:do\s+|da\s+|de\s+)?(.+?)(?:\s+cap(?:[ií]tulo)?\.?\s*(\d{1,2}))?\s*$/i);
  if (mStatus) {
    return consultarStatus(mStatus[1].trim(), mStatus[2] ? Number(mStatus[2]) : null);
  }

  // !avise <nome>: <mensagem>
  const mAvise = t.match(/^avise\s+(.+?)\s*:\s*([\s\S]+)$/i);
  if (mAvise) {
    return gravarMensagemAluno(mAvise[1].trim(), mAvise[2].trim());
  }

  return null;
}

/* ----------------- Ação: listar alunos ----------------- */
const ONLINE_LIMIAR_MS = 75_000;

async function listarAlunos(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const [usuariosRes, logsRes] = await Promise.all([
    supabase.from("usuarios").select("id, nome, ultima_presenca").order("nome"),
    supabase.from("logs_desempenho").select("usuario_id, resultado").limit(10000),
  ]);

  const usuarios = usuariosRes.data ?? [];
  if (!usuarios.length) return "Nenhum aluno cadastrado ainda. 📭" + SUGESTAO_COMANDOS;

  const stats: Record<string, { total: number; acertos: number }> = {};
  for (const l of logsRes.data ?? []) {
    stats[l.usuario_id] ??= { total: 0, acertos: 0 };
    stats[l.usuario_id].total++;
    if (l.resultado) stats[l.usuario_id].acertos++;
  }

  const agora = Date.now();
  const linhas = usuarios.map((u) => {
    const online =
      u.ultima_presenca && agora - new Date(u.ultima_presenca).getTime() < ONLINE_LIMIAR_MS;
    const s = stats[u.id];
    const desempenho = s?.total
      ? `${Math.round((s.acertos / s.total) * 100)}% em ${s.total} resposta(s)`
      : "sem atividade";
    return `${online ? "🟢" : "⚫"} *${u.nome}* — ${desempenho}`;
  });

  const onlines = usuarios.filter(
    (u) => u.ultima_presenca && agora - new Date(u.ultima_presenca).getTime() < ONLINE_LIMIAR_MS
  ).length;

  return (
    `👥 *Alunos cadastrados (${usuarios.length})* — ${onlines} online agora\n\n` +
    linhas.join("\n") +
    `\n\n🔎 Detalhes: *!status <nome>* · Erros: *!erros <nome>*` +
    SUGESTAO_COMANDOS
  );
}

/* ----------------- Ação: listar erros ----------------- */
async function listarErros(nome: string, capitulo: number | null): Promise<string> {
  if (!nome) return "Não entendi o nome do aluno. Ex: *!erros Lucas*" + SUGESTAO_COMANDOS;

  const supabase = getSupabaseAdmin();
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome")
    .ilike("nome", nome)
    .maybeSingle();

  if (!usuario) return `Não encontrei nenhum aluno chamado "${nome}" no app. 🤔` + SUGESTAO_COMANDOS;

  // tenta com a coluna resposta_marcada; se o banco ainda não tiver, refaz sem ela
  let logs: any[] | null = null;
  {
    let query = supabase
      .from("logs_desempenho")
      .select("capitulo, pergunta_id, resultado, resposta_marcada, timestamp")
      .eq("usuario_id", usuario.id)
      .order("timestamp", { ascending: true })
      .limit(3000);
    if (capitulo) query = query.eq("capitulo", capitulo);
    const r = await query;
    if (r.error && /resposta_marcada/i.test(r.error.message ?? "")) {
      let q2 = supabase
        .from("logs_desempenho")
        .select("capitulo, pergunta_id, resultado, timestamp")
        .eq("usuario_id", usuario.id)
        .order("timestamp", { ascending: true })
        .limit(3000);
      if (capitulo) q2 = q2.eq("capitulo", capitulo);
      logs = (await q2).data;
    } else {
      logs = r.data;
    }
  }

  if (!logs?.length) {
    return capitulo
      ? `${usuario.nome} ainda não respondeu nada do capítulo ${capitulo}. 📭`
      : `${usuario.nome} ainda não respondeu nenhuma pergunta. 📭`;
  }

  // Estado atual de cada pergunta: considera ERRADA se a ÚLTIMA resposta foi erro.
  // Guarda também a alternativa marcada no ÚLTIMO erro.
  const ultima = new Map<
    string,
    { capitulo: number; resultado: boolean; marcadaNoErro: number | null }
  >();
  const jaErrou = new Map<string, number>();
  for (const l of logs) {
    const anterior = ultima.get(l.pergunta_id);
    ultima.set(l.pergunta_id, {
      capitulo: l.capitulo,
      resultado: l.resultado,
      marcadaNoErro: !l.resultado
        ? typeof l.resposta_marcada === "number"
          ? l.resposta_marcada
          : null
        : anterior?.marcadaNoErro ?? null,
    });
    if (!l.resultado) jaErrou.set(l.pergunta_id, (jaErrou.get(l.pergunta_id) ?? 0) + 1);
  }

  const pendentes = Array.from(ultima.entries())
    .filter(([, v]) => !v.resultado)
    .sort((a, b) => a[1].capitulo - b[1].capitulo);

  const escopo = capitulo ? ` no Cap ${capitulo}` : "";
  if (!pendentes.length) {
    const corrigidas = jaErrou.size;
    return (
      `🎉 *${usuario.nome}* não tem erros pendentes${escopo}!` +
      (corrigidas
        ? `\n(Errou ${corrigidas} questão(ões) no passado, mas já acertou todas depois — revisão funcionando! 🧠)`
        : "") +
      SUGESTAO_COMANDOS
    );
  }

  const LIMITE = 6; // não estourar o tamanho da mensagem no WhatsApp
  const LETRAS = ["A", "B", "C", "D"];
  const linhas: string[] = [];
  for (const [perguntaId, info] of pendentes.slice(0, LIMITE)) {
    const cap = getCapitulo(info.capitulo);
    const q = cap?.quiz.find((x) => x.id === perguntaId);
    const vezes = jaErrou.get(perguntaId) ?? 1;
    if (q) {
      const marcou =
        info.marcadaNoErro !== null && info.marcadaNoErro !== undefined
          ? `   ❌ Marcou: _${LETRAS[info.marcadaNoErro] ?? "?"}) ${
              q.opcoes[info.marcadaNoErro] ?? "?"
            }_\n`
          : "";
      linhas.push(
        `*Cap ${info.capitulo}:* ${q.pergunta}\n` +
          marcou +
          `   ✅ Certa: _${LETRAS[q.correta]}) ${q.opcoes[q.correta]}_` +
          (vezes > 1 ? `\n   🔁 Errou ${vezes}x` : "")
      );
    } else {
      linhas.push(`*Cap ${info.capitulo}:* questão ${perguntaId}` + (vezes > 1 ? ` (errou ${vezes}x)` : ""));
    }
  }

  let resposta =
    `❌ *Erros pendentes de ${usuario.nome}${escopo}* (${pendentes.length} questão(ões)):\n\n` +
    linhas.join("\n\n");

  if (pendentes.length > LIMITE) {
    const caps = Array.from(new Set(pendentes.slice(LIMITE).map(([, v]) => v.capitulo))).join(", ");
    resposta += `\n\n…e mais ${pendentes.length - LIMITE} (caps ${caps}). Use *!erros ${usuario.nome} cap N* para filtrar.`;
  }
  resposta += `\n\n💡 Peça para ${usuario.nome} usar a *Revisão Inteligente* 🧠 no app — ela treina exatamente essas questões.`;
  return resposta;
}

/* ----------------- IA: interpreta a mensagem ----------------- */
async function interpretarMensagem(texto: string): Promise<IntencaoIA> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.chatanywhere.org/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  if (!apiKey) return { acao: "conversa" };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você interpreta comandos do professor de um app de quiz bíblico (Êxodo, capítulos 1-20). " +
              'Responda SOMENTE com JSON: {"acao": "consulta_status"|"enviar_mensagem"|"conversa", ' +
              '"nome": string|null, "capitulo": number|null, "mensagem": string|null, "resposta_livre": string|null}. ' +
              "consulta_status = ele quer saber o desempenho de um aluno (extraia nome e, se citado, capítulo). " +
              "enviar_mensagem = ele quer mandar recado/aviso a um aluno (extraia nome — use 'todos' para broadcast — e o texto da mensagem). " +
              "conversa = qualquer outra coisa; nesse caso escreva uma resposta curta e simpática em resposta_livre.",
          },
          { role: "user", content: texto },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json();
    return JSON.parse(json?.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return { acao: "conversa" };
  }
}

/* ----------------- Ação: consultar status ----------------- */
async function consultarStatus(nome: string, capitulo: number | null): Promise<string> {
  if (!nome) return "Não entendi o nome do aluno. Pode repetir? 🙏";

  const supabase = getSupabaseAdmin();
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome")
    .ilike("nome", nome)
    .maybeSingle();

  if (!usuario) return `Não encontrei nenhum aluno chamado "${nome}" no app. 🤔`;

  let query = supabase
    .from("logs_desempenho")
    .select("capitulo, resultado")
    .eq("usuario_id", usuario.id);
  if (capitulo) query = query.eq("capitulo", capitulo);

  const { data: logs } = await query;
  const total = logs?.length ?? 0;
  if (!total) {
    return capitulo
      ? `${usuario.nome} ainda não respondeu nenhuma pergunta do capítulo ${capitulo}. 📭`
      : `${usuario.nome} ainda não respondeu nenhuma pergunta. 📭`;
  }

  const acertos = logs!.filter((l) => l.resultado).length;
  const erros = total - acertos;
  const taxa = Math.round((acertos / total) * 100);

  if (capitulo) {
    return (
      `📊 *${usuario.nome} — Capítulo ${capitulo}*\n` +
      `✅ Acertos: ${acertos}\n❌ Erros: ${erros}\n🎯 Taxa: ${taxa}%` +
      (taxa < 70 ? `\n\n💡 Sugestão: peça para revisar o resumo do capítulo ${capitulo}.` : "\n\n👏 Muito bem!") +
      (erros > 0 ? `\n\n🔎 Veja o que errou: *!erros ${usuario.nome} cap ${capitulo}*` : "") +
      SUGESTAO_COMANDOS
    );
  }

  // Visão geral por capítulo
  const porCap = new Map<number, { a: number; e: number }>();
  for (const l of logs!) {
    const c = porCap.get(l.capitulo) ?? { a: 0, e: 0 };
    l.resultado ? c.a++ : c.e++;
    porCap.set(l.capitulo, c);
  }
  const linhas = Array.from(porCap.entries())
    .sort((x, y) => x[0] - y[0])
    .map(([cap, c]) => `• Cap ${cap}: ✅${c.a} ❌${c.e}`)
    .join("\n");

  return (
    `📊 *${usuario.nome} — Desempenho geral*\n${linhas}\n\n🎯 Total: ${acertos}/${total} (${taxa}%)` +
    (erros > 0 ? `\n\n🔎 Veja o que errou: *!erros ${usuario.nome}*` : "") +
    SUGESTAO_COMANDOS
  );
}

/* ----------------- Ação: gravar mensagem ----------------- */
async function gravarMensagemAluno(nome: string, mensagem: string): Promise<string> {
  if (!mensagem) return "Não entendi qual mensagem devo enviar. Pode repetir? 🙏";

  const supabase = getSupabaseAdmin();
  let usuarioId: string | null = null;
  let destino = "todos os alunos 📢";

  if (nome.toLowerCase() !== "todos") {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nome")
      .ilike("nome", nome)
      .maybeSingle();
    if (!usuario) return `Não encontrei o aluno "${nome}" no app. 🤔`;
    usuarioId = usuario.id;
    destino = usuario.nome;
  }

  const { error } = await supabase
    .from("mensagens_admin")
    .insert({ usuario_id: usuarioId, mensagem });
  if (error) return "⚠️ Erro ao gravar a mensagem. Tente novamente.";

  return `✅ Mensagem registrada! ${destino} verá o aviso no app:\n\n_"${mensagem}"_`;
}

/* ----------------- Envio via Z-API ----------------- */
async function enviarTextoZapi(phone: string, message: string) {
  const id = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_INSTANCE_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!id || !token) {
    console.warn("[zapi] Credenciais Z-API não configuradas — resposta não enviada.");
    return;
  }

  await fetch(`https://api.z-api.io/instances/${id}/token/${token}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(clientToken ? { "Client-Token": clientToken } : {}),
    },
    body: JSON.stringify({ phone, message }),
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => console.error("[zapi] Falha ao enviar:", e));
}
