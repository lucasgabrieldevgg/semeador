"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import HelpButton from "@/components/HelpButton";
import GerenciadorContas from "@/components/GerenciadorContas";
import { getCapitulo } from "@/data/capitulos";

interface CapStats { total: number; acertos: number; erros: number; taxa: number; alunos: number }
interface UsuarioMetrica {
  id: string;
  nome: string;
  criado_em: string;
  total_respostas: number;
  acertos: number;
  erros: number;
  taxa: number | null;
  capitulos_estudados: number;
  progresso_pct: number;
  ultima_atividade: string | null;
  por_capitulo: Record<number, { acertos: number; erros: number; taxa: number }>;
}
interface Metricas {
  totalUsuarios: number;
  totalRespostas: number;
  totalAcertos: number;
  totalErros: number;
  taxaAcerto: number;
  ativosHoje: number;
  ativosSemana: number;
  respostasHoje: number;
  capituloMaisDificil: number | null;
  capituloMaisFacil: number | null;
  porCapitulo: Record<number, CapStats>;
  perguntasMaisErradas: { pergunta_id: string; capitulo: number; total: number; erros: number; taxa_erro: number }[];
  usuarios: UsuarioMetrica[];
  atividadeRecente: { aluno: string; capitulo: number; pergunta_id: string; resultado: boolean; timestamp: string }[];
  mensagensRecentes: { id: number; mensagem: string; lida: boolean; criado_em: string; usuario_id: string | null }[];
}

function textoPergunta(perguntaId: string, capitulo: number): string {
  const cap = getCapitulo(capitulo);
  const q = cap?.quiz.find((q) => q.id === perguntaId);
  return q?.pergunta ?? perguntaId;
}

/**
 * PAINEL DO ADMIN (rota oculta /admin-dashboard)
 * Backdoor: "adalberto" ou "batalha2026" no onboarding.
 */
export default function AdminDashboard() {
  const [m, setM] = useState<Metricas | null>(null);
  const [erro, setErro] = useState("");
  const [alunoAberto, setAlunoAberto] = useState<string | null>(null);

  // Form de mensagem
  const [destino, setDestino] = useState<string>("todos");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Gerenciamento de usuários
  const [gerenciando, setGerenciando] = useState(false);
  const [feedbackUsuario, setFeedbackUsuario] = useState("");

  async function renomearAluno(u: UsuarioMetrica) {
    const novoNome = window.prompt(`Novo nome para "${u.nome}":`, u.nome);
    if (!novoNome || novoNome.trim() === u.nome) return;
    setGerenciando(true);
    setFeedbackUsuario("");
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: u.id, acao: "renomear", novoNome: novoNome.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro ?? "Erro ao renomear.");
      setFeedbackUsuario(`✅ ${json.mensagem}`);
      carregar();
    } catch (e: any) {
      setFeedbackUsuario(`❌ ${e.message}`);
    } finally {
      setGerenciando(false);
    }
  }

  async function limparProgresso(u: UsuarioMetrica) {
    if (
      !window.confirm(
        `Zerar TODO o progresso de quiz de "${u.nome}"?\n\n` +
          `Isso apaga as ${u.total_respostas} respostas registradas (acertos e erros). ` +
          `O aluno, o chat e as mensagens são mantidos.\n\nEssa ação não pode ser desfeita.`
      )
    )
      return;
    setGerenciando(true);
    setFeedbackUsuario("");
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: u.id, acao: "limpar_progresso" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro ?? "Erro ao limpar progresso.");
      setFeedbackUsuario(`✅ Progresso de "${u.nome}" zerado.`);
      carregar();
    } catch (e: any) {
      setFeedbackUsuario(`❌ ${e.message}`);
    } finally {
      setGerenciando(false);
    }
  }

  async function excluirAluno(u: UsuarioMetrica) {
    if (
      !window.confirm(
        `EXCLUIR o aluno "${u.nome}" permanentemente?\n\n` +
          `Serão apagados: conta, respostas de quiz, sessões, mensagens, chats e desafios.\n\n` +
          `Essa ação NÃO pode ser desfeita.`
      )
    )
      return;
    // dupla confirmação para exclusão
    const digitado = window.prompt(`Para confirmar, digite o nome do aluno: ${u.nome}`);
    if (digitado?.trim().toLowerCase() !== u.nome.toLowerCase()) {
      setFeedbackUsuario("⚠️ Exclusão cancelada (nome não confere).");
      return;
    }
    setGerenciando(true);
    setFeedbackUsuario("");
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: u.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro ?? "Erro ao excluir.");
      setFeedbackUsuario(`✅ ${json.mensagem}`);
      setAlunoAberto(null);
      carregar();
    } catch (e: any) {
      setFeedbackUsuario(`❌ ${e.message}`);
    } finally {
      setGerenciando(false);
    }
  }

  async function carregar() {
    try {
      const res = await fetch("/api/admin/metricas");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro ?? "Erro ao carregar métricas.");
      setM(json);
    } catch (e: any) {
      setErro(e.message);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 60_000); // atualiza a cada 60s
    return () => clearInterval(intervalo);
  }, []);

  async function enviarMensagem(e: React.FormEvent) {
    e.preventDefault();
    if (!mensagem.trim()) return;
    setEnviando(true);
    setFeedback("");
    try {
      const res = await fetch("/api/admin/mensagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioId: destino === "todos" ? null : destino,
          mensagem: mensagem.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro ?? "Erro ao enviar.");
      setFeedback("✅ Mensagem enviada! O aluno verá no app.");
      setMensagem("");
      carregar();
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally {
      setEnviando(false);
    }
  }

  const fmtData = (d: string | null) =>
    d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-4 pb-24">
      <header className="sticky top-0 z-40 bg-[#f7f7f7]/90 dark:bg-[#131f24]/90 backdrop-blur py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">
            🛡️ Painel do <span className="text-duo-purple">Admin</span>
          </h1>
          <p className="text-sm font-bold text-gray-400">Bem-vindo, Adalberto! · atualiza a cada 60s</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/" className="btn-ghost !px-3 !py-2 text-sm">Sair</Link>
        </div>
      </header>

      {erro && (
        <div className="card !border-duo-red mt-4">
          <p className="text-duo-red font-bold">⚠️ {erro}</p>
        </div>
      )}

      {/* ===== VISÃO GERAL ===== */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        {[
          ["👥", "Alunos", m?.totalUsuarios ?? "—"],
          ["🔥", "Ativos hoje", m?.ativosHoje ?? "—"],
          ["📅", "Ativos na semana", m?.ativosSemana ?? "—"],
          ["✍️", "Respostas hoje", m?.respostasHoje ?? "—"],
          ["📊", "Total respostas", m?.totalRespostas ?? "—"],
          ["✅", "Acertos", m?.totalAcertos ?? "—"],
          ["❌", "Erros", m?.totalErros ?? "—"],
          ["🎯", "Taxa geral", m ? `${m.taxaAcerto}%` : "—"],
        ].map(([icone, rotulo, valor]) => (
          <div key={String(rotulo)} className="card text-center !p-4">
            <div className="text-2xl">{icone}</div>
            <div className="text-2xl font-extrabold mt-1">{valor}</div>
            <div className="text-xs font-bold text-gray-400 uppercase">{rotulo}</div>
          </div>
        ))}
      </section>

      {/* Destaques */}
      {m && (m.capituloMaisDificil || m.capituloMaisFacil) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {m.capituloMaisDificil && (
            <div className="card !border-duo-red !p-4 flex items-center gap-3">
              <span className="text-3xl">🆘</span>
              <div>
                <p className="font-extrabold">Capítulo mais difícil: Cap {m.capituloMaisDificil}</p>
                <p className="text-sm font-semibold text-gray-400">
                  Taxa de acerto: {m.porCapitulo[m.capituloMaisDificil]?.taxa}% — considere revisar com a turma
                </p>
              </div>
            </div>
          )}
          {m.capituloMaisFacil && (
            <div className="card !border-duo-green !p-4 flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="font-extrabold">Melhor capítulo: Cap {m.capituloMaisFacil}</p>
                <p className="text-sm font-semibold text-gray-400">
                  Taxa de acerto: {m.porCapitulo[m.capituloMaisFacil]?.taxa}% — a turma mandou bem!
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===== DESEMPENHO POR CAPÍTULO ===== */}
      <section className="card mt-6">
        <h2 className="font-extrabold text-lg mb-3">📚 Desempenho por capítulo</h2>
        {!m || !Object.keys(m.porCapitulo).length ? (
          <p className="text-gray-400 font-semibold">Nenhuma resposta registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(m.porCapitulo)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([cap, st]) => (
                <div key={cap} className="flex items-center gap-3">
                  <span className="font-extrabold w-16 shrink-0">Cap {cap}</span>
                  <div className="flex-1 h-5 rounded-full bg-gray-200 dark:bg-[#37464f] overflow-hidden flex">
                    <div className="h-full bg-duo-green" style={{ width: `${st.taxa}%` }} />
                    <div className="h-full bg-duo-red" style={{ width: `${100 - st.taxa}%` }} />
                  </div>
                  <span className="text-xs font-bold w-40 shrink-0 text-right text-gray-400">
                    {st.taxa}% · ✅{st.acertos} ❌{st.erros} · 👥{st.alunos}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ===== PERGUNTAS MAIS ERRADAS ===== */}
      <section className="card mt-6">
        <h2 className="font-extrabold text-lg mb-3">🚨 Perguntas mais erradas (top 10)</h2>
        {!m?.perguntasMaisErradas.length ? (
          <p className="text-gray-400 font-semibold">Nenhum erro registrado. 🎉</p>
        ) : (
          <ul className="space-y-3">
            {m.perguntasMaisErradas.map((p) => (
              <li key={p.pergunta_id} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className="font-extrabold text-duo-red shrink-0">{p.taxa_erro}%</span>
                  <div className="flex-1">
                    <p className="font-bold">{textoPergunta(p.pergunta_id, p.capitulo)}</p>
                    <p className="text-xs text-gray-400 font-semibold">
                      Cap {p.capitulo} · errada {p.erros}x de {p.total} tentativas
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===== MENSAGENS ===== */}
      <section className="card mt-6">
        <h2 className="font-extrabold text-lg mb-3">📨 Enviar mensagem aos alunos</h2>
        <form onSubmit={enviarMensagem} className="space-y-3">
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="w-full rounded-2xl border-2 border-gray-300 dark:border-[#37464f] bg-white dark:bg-[#202f36] px-4 py-3 font-bold"
            aria-label="Destinatário"
          >
            <option value="todos">📢 Todos os alunos (broadcast)</option>
            {m?.usuarios.map((u) => (
              <option key={u.id} value={u.id}>👤 {u.nome}</option>
            ))}
          </select>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={3}
            placeholder="Ex.: Parabéns pelo progresso! Revise o capítulo 3 antes do próximo quiz. 💪"
            className="w-full rounded-2xl border-2 border-gray-300 dark:border-[#37464f] bg-white dark:bg-[#202f36] px-4 py-3 font-semibold focus:outline-none focus:border-duo-blue"
          />
          <button type="submit" disabled={enviando || !mensagem.trim()} className="btn-blue w-full disabled:opacity-50">
            {enviando ? "Enviando..." : "Enviar mensagem 📨"}
          </button>
          {feedback && <p className="font-bold text-sm animate-pop">{feedback}</p>}
        </form>
      </section>

      {/* ===== GERENCIADOR DE CONTAS ===== */}
      <GerenciadorContas aoMudar={carregar} />

      {/* ===== ALUNOS (desempenho detalhado, clique para expandir) ===== */}
      <section className="card mt-6">
        <h2 className="font-extrabold text-lg mb-3">📈 Desempenho por aluno ({m?.usuarios.length ?? 0})</h2>
        {feedbackUsuario && (
          <p className="font-bold text-sm mb-3 animate-pop" role="status">{feedbackUsuario}</p>
        )}
        {!m?.usuarios.length && <p className="text-gray-400 font-semibold">Nenhum aluno ainda.</p>}
        <ul className="divide-y divide-gray-200 dark:divide-[#37464f]">
          {m?.usuarios.map((u) => (
            <li key={u.id} className="py-3">
              <button
                className="w-full flex items-center justify-between gap-3 text-left"
                onClick={() => setAlunoAberto(alunoAberto === u.id ? null : u.id)}
              >
                <div className="min-w-0">
                  <p className="font-extrabold truncate">
                    {alunoAberto === u.id ? "▾" : "▸"} {u.nome}
                  </p>
                  <p className="text-xs font-semibold text-gray-400">
                    📈 {u.capitulos_estudados}/20 capítulos ({u.progresso_pct}%) · última atividade: {fmtData(u.ultima_atividade)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {u.taxa !== null ? (
                    <>
                      <span className={`font-extrabold text-lg ${u.taxa >= 70 ? "text-duo-green" : "text-duo-red"}`}>
                        {u.taxa}%
                      </span>
                      <p className="text-xs font-semibold text-gray-400">✅ {u.acertos} · ❌ {u.erros}</p>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-gray-400">Sem atividade</span>
                  )}
                </div>
              </button>

              {/* Detalhe por capítulo */}
              {alunoAberto === u.id && Object.keys(u.por_capitulo).length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-pop">
                  {Object.entries(u.por_capitulo)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([cap, c]) => (
                      <div
                        key={cap}
                        className={`rounded-xl border-2 p-2 text-center text-xs font-bold ${
                          c.taxa >= 70
                            ? "border-duo-green bg-green-50 dark:bg-[#1c3a18]"
                            : "border-duo-red bg-red-50 dark:bg-[#451b1b]"
                        }`}
                      >
                        <p>Cap {cap}</p>
                        <p className="text-base">{c.taxa}%</p>
                        <p className="text-gray-400">✅{c.acertos} ❌{c.erros}</p>
                      </div>
                    ))}
                </div>
              )}
              {alunoAberto === u.id && !Object.keys(u.por_capitulo).length && (
                <p className="mt-2 text-sm text-gray-400 font-semibold">Este aluno ainda não respondeu nenhum quiz.</p>
              )}

              {/* Ações de gerenciamento */}
              {alunoAberto === u.id && (
                <div className="mt-3 flex flex-wrap gap-2 animate-pop">
                  <button
                    onClick={() => renomearAluno(u)}
                    disabled={gerenciando}
                    className="btn-ghost !px-3 !py-2 text-xs disabled:opacity-50"
                    title="Alterar o nome do aluno"
                  >
                    ✏️ Renomear
                  </button>
                  <button
                    onClick={() => limparProgresso(u)}
                    disabled={gerenciando || u.total_respostas === 0}
                    className="btn-ghost !px-3 !py-2 text-xs disabled:opacity-50"
                    title="Apaga todas as respostas de quiz (mantém a conta)"
                  >
                    🧹 Zerar progresso
                  </button>
                  <button
                    onClick={() => excluirAluno(u)}
                    disabled={gerenciando}
                    className="btn-red !px-3 !py-2 text-xs disabled:opacity-50"
                    title="Exclui o aluno e todos os dados dele"
                  >
                    🗑️ Excluir aluno
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ===== ATIVIDADE RECENTE ===== */}
      <section className="card mt-6">
        <h2 className="font-extrabold text-lg mb-3">🕓 Atividade recente</h2>
        {!m?.atividadeRecente.length ? (
          <p className="text-gray-400 font-semibold">Nenhuma atividade ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {m.atividadeRecente.map((a, i) => (
              <li key={i} className="text-sm font-semibold flex items-center gap-2">
                <span>{a.resultado ? "✅" : "❌"}</span>
                <span className="font-extrabold">{a.aluno}</span>
                <span className="text-gray-400">· Cap {a.capitulo} ·</span>
                <span className="text-gray-400 text-xs flex-1 truncate">{fmtData(a.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===== MENSAGENS RECENTES ===== */}
      <section className="card mt-6">
        <h2 className="font-extrabold text-lg mb-3">📩 Mensagens enviadas</h2>
        {!m?.mensagensRecentes.length && (
          <p className="text-gray-400 font-semibold">Nenhuma mensagem enviada ainda.</p>
        )}
        <ul className="space-y-2">
          {m?.mensagensRecentes.map((msg) => (
            <li key={msg.id} className="text-sm font-semibold flex items-start gap-2">
              <span title={msg.lida ? "Lida" : "Não lida"}>{msg.lida ? "✅" : "📩"}</span>
              <span className="flex-1">{msg.mensagem}</span>
              <span className="text-xs text-gray-400 shrink-0">{fmtData(msg.criado_em)}</span>
            </li>
          ))}
        </ul>
      </section>

      <HelpButton
        texto={
          "Painel do Administrador 🛡️\n\n" +
          "• VISÃO GERAL: alunos, ativos hoje/semana, respostas e taxa de acerto.\n" +
          "• POR CAPÍTULO: barras verde/vermelho mostram acertos vs erros.\n" +
          "• PERGUNTAS MAIS ERRADAS: onde a turma mais tropeça.\n" +
          "• GERENCIAR CONTAS: busque, crie (+Criar), ✏️ renomeie, 🧹 zere progresso e 🗑️ exclua contas — com seleção múltipla para excluir várias de uma vez. Bolinha verde = online agora.\n" +
          "• DESEMPENHO POR ALUNO: toque em um aluno para ver capítulo por capítulo.\n" +
          "• MENSAGENS: envie avisos para um aluno ou para todos.\n\n" +
          "Exclusões pedem dupla confirmação e não podem ser desfeitas."
        }
      />
    </main>
  );
}
