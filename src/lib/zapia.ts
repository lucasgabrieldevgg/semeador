import { getSupabaseAdmin } from "./supabaseAdmin";

/* ============================================================
 * INTEGRAÇÃO ZAPIA MAX
 * ------------------------------------------------------------
 * A) Site -> Zapia: relatório consolidado da sessão (webhook)
 * B) Zapia -> Site: autenticação por API Key (header x-api-key)
 * ============================================================ */

/** Valida o header x-api-key enviado pela Zapia Max nas Custom Actions */
export function validarApiKeyZapia(req: Request): boolean {
  const esperado = process.env.ZAPIA_API_KEY;
  if (!esperado) return false; // sem chave configurada => nega tudo
  const recebido =
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return recebido === esperado;
}

interface LogSessao {
  capitulo: number;
  pergunta_id: string;
  resultado: boolean;
}

/**
 * Transforma logs brutos em uma frase legível para a IA da Zapia.
 * Ex.: "Errou 2 perguntas no Cap 3, acertou todas no Cap 4"
 */
export function consolidarResumoSessao(logs: LogSessao[]): string {
  if (!logs.length) return "Nenhuma atividade registrada na sessão.";

  const porCapitulo = new Map<number, { acertos: number; erros: number }>();
  for (const log of logs) {
    const atual = porCapitulo.get(log.capitulo) ?? { acertos: 0, erros: 0 };
    if (log.resultado) atual.acertos++;
    else atual.erros++;
    porCapitulo.set(log.capitulo, atual);
  }

  const partes: string[] = [];
  const capitulos = Array.from(porCapitulo.keys()).sort((a, b) => a - b);

  for (const cap of capitulos) {
    const { acertos, erros } = porCapitulo.get(cap)!;
    if (erros === 0) {
      partes.push(`acertou todas as ${acertos} perguntas no Cap ${cap}`);
    } else if (acertos === 0) {
      partes.push(`errou todas as ${erros} perguntas no Cap ${cap}`);
    } else {
      partes.push(`errou ${erros} e acertou ${acertos} perguntas no Cap ${cap}`);
    }
  }

  const frase = partes.join(", ");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/**
 * Dispara o webhook POST para a Zapia Max com o resumo da sessão.
 * Payload: { usuario, resumo_sessao, detalhes }
 */
export async function enviarRelatorioParaZapia(payload: {
  usuario: string;
  resumo_sessao: string;
  detalhes?: unknown;
}): Promise<{ ok: boolean; status?: number; erro?: string }> {
  const url = process.env.ZAPIA_WEBHOOK_URL;

  // Fallback: sem webhook da Zapia, manda o relatório direto no WhatsApp
  // do Adalberto via Z-API (a Zapia Max lê a conversa e fica sabendo).
  if (!url) {
    const enviadoWhats = await enviarRelatorioViaZapi(payload);
    if (enviadoWhats) return { ok: true, status: 200 };
    console.warn("[zapia] Nem ZAPIA_WEBHOOK_URL nem Z-API configurados — webhook ignorado.");
    return { ok: false, erro: "ZAPIA_WEBHOOK_URL não configurada" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ZAPIA_API_KEY ?? "",
      },
      body: JSON.stringify(payload),
      // timeout defensivo
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("[zapia] Falha ao enviar webhook:", e);
    return { ok: false, erro: String(e) };
  }
}

/**
 * Fallback: envia o relatório de sessão como mensagem de WhatsApp via Z-API.
 * Destino: o GRUPO de relatórios (REPORT_GROUP_ID), se configurado;
 * senão, a DM do admin (ADMIN_PHONE).
 */
async function enviarRelatorioViaZapi(payload: {
  usuario: string;
  resumo_sessao: string;
}): Promise<boolean> {
  const id = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_INSTANCE_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  const destino = process.env.REPORT_GROUP_ID || process.env.ADMIN_PHONE;
  if (!id || !token || !destino) return false;

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${id}/token/${token}/send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientToken ? { "Client-Token": clientToken } : {}),
        },
        body: JSON.stringify({
          phone: destino,
          message:
            `📚 *Relatório de sessão — Êxodo Quest*\n\n` +
            `👤 Aluno: *${payload.usuario}*\n` +
            `📊 ${payload.resumo_sessao}\n\n` +
            `🔎 Ver as questões erradas: *!erros ${payload.usuario}*\n` +
            `💡 Todos os comandos: *!comandos*`,
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );
    return res.ok;
  } catch (e) {
    console.error("[zapi] Falha no envio do relatório via WhatsApp:", e);
    return false;
  }
}

/* ============================================================
 * LÓGICA DOS 10 MINUTOS (lado servidor)
 * ------------------------------------------------------------
 * Varre sessões inativas há >= 10 min sem relatório enviado,
 * consolida os logs e dispara o webhook. É chamada:
 *   1. Pelo endpoint /api/sessao/flush (sendBeacon ao fechar o app
 *      ou timer de inatividade do client);
 *   2. Por um cron (Vercel Cron / Supabase Edge cron) a cada 5 min,
 *      cobrindo o caso de o usuário fechar o app abruptamente.
 * ============================================================ */
export const SESSAO_TIMEOUT_MS = 10 * 60 * 1000;

export async function processarSessoesInativas(opts?: {
  sessaoId?: string;   // força flush de uma sessão específica (sendBeacon)
  forcar?: boolean;    // ignora o critério dos 10 min (fechamento do app)
}) {
  const supabase = getSupabaseAdmin();
  const limite = new Date(Date.now() - SESSAO_TIMEOUT_MS).toISOString();

  let query = supabase
    .from("sessoes_quiz")
    .select("id, usuario_id, iniciada_em, ultima_atividade, usuarios(nome)")
    .eq("relatorio_enviado", false);

  if (opts?.sessaoId) {
    query = query.eq("id", opts.sessaoId);
  }
  if (!opts?.forcar) {
    query = query.lte("ultima_atividade", limite);
  }

  const { data: sessoes, error } = await query;
  if (error) throw error;
  if (!sessoes?.length) return { processadas: 0, resultados: [] as unknown[] };

  const resultados = [];

  for (const sessao of sessoes) {
    // Logs da janela da sessão
    const { data: logs, error: logsErr } = await supabase
      .from("logs_desempenho")
      .select("capitulo, pergunta_id, resultado")
      .eq("usuario_id", sessao.usuario_id)
      .gte("timestamp", sessao.iniciada_em)
      .lte("timestamp", sessao.ultima_atividade);

    if (logsErr) {
      resultados.push({ sessao: sessao.id, ok: false, erro: logsErr.message });
      continue;
    }

    const nomeUsuario =
      (sessao as any).usuarios?.nome ?? "Usuário desconhecido";
    const resumo = consolidarResumoSessao(logs ?? []);

    const envio = await enviarRelatorioParaZapia({
      usuario: nomeUsuario,
      resumo_sessao: resumo,
      detalhes: logs,
    });

    // Marca como enviada SOMENTE se o envio deu certo (webhook ou WhatsApp).
    // Se nada estiver configurado/funcionando (ex: Z-API expirou), a sessão
    // fica pendente e será entregue à Zapia via GET /api/relatorios-pendentes.
    if (envio.ok) {
      await supabase
        .from("sessoes_quiz")
        .update({ relatorio_enviado: true, enviado_em: new Date().toISOString() })
        .eq("id", sessao.id);
    }

    resultados.push({ sessao: sessao.id, usuario: nomeUsuario, resumo, envio });
  }

  return { processadas: resultados.length, resultados };
}
