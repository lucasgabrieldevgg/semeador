"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import HelpButton from "@/components/HelpButton";
import { usePresenca } from "@/lib/usePresenca";
import { CAPITULOS } from "@/data/capitulos";

interface Usuario { id: string; nome: string }
interface UsuarioLista { id: string; nome: string; online: boolean }
interface MsgChat { id: number; de_usuario: string; para_usuario: string; mensagem: string; criado_em: string }

/**
 * 👥 COMUNIDADE: lista de alunos (online/offline), chat 1-a-1 e desafios.
 */
export default function Comunidade() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [lista, setLista] = useState<UsuarioLista[]>([]);
  const [chatCom, setChatCom] = useState<UsuarioLista | null>(null);
  const [desafiando, setDesafiando] = useState<UsuarioLista | null>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("exodo-usuario");
      if (!salvo) { router.replace("/"); return; }
      setUsuario(JSON.parse(salvo));
    } catch { router.replace("/"); }
  }, [router]);

  usePresenca(usuario?.id ?? null);

  // Lista de usuários (atualiza a cada 15s)
  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    async function buscar() {
      try {
        const res = await fetch("/api/presenca");
        const json = await res.json();
        if (ativo && json?.usuarios) {
          setLista(json.usuarios.filter((u: UsuarioLista) => u.id !== usuario!.id));
        }
      } catch {}
    }
    buscar();
    const i = setInterval(buscar, 15_000);
    return () => { ativo = false; clearInterval(i); };
  }, [usuario]);

  if (!usuario) return null;

  const online = lista.filter((u) => u.online);
  const offline = lista.filter((u) => !u.online);

  return (
    <main className="min-h-screen max-w-lg mx-auto px-4 pb-24">
      <header className="sticky top-0 z-40 bg-[#f7f7f7]/90 dark:bg-[#131f24]/90 backdrop-blur py-4 flex items-center justify-between gap-3">
        <Link href="/trilha" className="font-extrabold text-duo-blue hover:underline">← Trilha</Link>
        <h1 className="text-xl font-extrabold">👥 Comunidade</h1>
        <ThemeToggle />
      </header>

      <p className="text-sm font-bold text-gray-400 mb-4">
        🟢 {online.length} online · ⚫ {offline.length} offline
      </p>

      {lista.length === 0 && (
        <div className="card text-center !p-8">
          <div className="text-5xl mb-3">🏜️</div>
          <p className="font-extrabold">Nenhum outro aluno ainda</p>
          <p className="text-sm font-semibold text-gray-400 mt-1">Convide seus amigos para estudar Êxodo com você!</p>
        </div>
      )}

      <ul className="space-y-3">
        {[...online, ...offline].map((u) => (
          <li key={u.id} className="card !p-4 flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-duo-blue flex items-center justify-center text-white text-xl font-extrabold">
                {u.nome.charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-[#202f36] ${
                  u.online ? "bg-duo-green" : "bg-gray-400"
                }`}
                title={u.online ? "Online" : "Offline"}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold truncate">{u.nome}</p>
              <p className={`text-xs font-bold ${u.online ? "text-duo-green" : "text-gray-400"}`}>
                {u.online ? "● Online agora" : "○ Offline"}
              </p>
            </div>
            <button onClick={() => setChatCom(u)} className="btn-ghost !px-3 !py-2 text-sm" title="Conversar">
              💬
            </button>
            <button
              onClick={() => u.online && setDesafiando(u)}
              disabled={!u.online}
              className={`btn-duo !px-3 !py-2 text-sm ${
                u.online
                  ? "bg-duo-yellow border-yellow-600 text-yellow-900"
                  : "bg-gray-200 dark:bg-[#37464f] border-gray-300 dark:border-[#2a3b44] text-gray-400 cursor-not-allowed"
              }`}
              title={u.online ? "Desafiar para um duelo!" : "Só é possível desafiar quem está online"}
            >
              ⚔️
            </button>
          </li>
        ))}
      </ul>

      {chatCom && <JanelaChat eu={usuario} outro={chatCom} fechar={() => setChatCom(null)} />}
      {desafiando && (
        <ModalDesafio eu={usuario} alvo={desafiando} fechar={() => setDesafiando(null)} />
      )}

      <HelpButton
        texto={
          "Comunidade 👥\n\n" +
          "• Veja quem está 🟢 online ou ⚫ offline.\n" +
          "• 💬 Converse com qualquer aluno pelo chat.\n" +
          "• ⚔️ Desafie um aluno ONLINE para um duelo de quiz: você escolhe o capítulo, ele recebe o convite na hora, e vence quem acertar mais!\n\n" +
          "Os convites de desafio aparecem como notificação para quem está com o app aberto."
        }
      />
    </main>
  );
}

/* ================= CHAT 1-A-1 ================= */
function JanelaChat({ eu, outro, fechar }: { eu: Usuario; outro: UsuarioLista; fechar: () => void }) {
  const [msgs, setMsgs] = useState<MsgChat[]>([]);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat?u1=${eu.id}&u2=${outro.id}`);
      const json = await res.json();
      if (json?.mensagens) setMsgs(json.mensagens);
    } catch {}
  }, [eu.id, outro.id]);

  useEffect(() => {
    buscar();
    const i = setInterval(buscar, 4000); // polling do chat a cada 4s
    return () => clearInterval(i);
  }, [buscar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    // otimista
    setMsgs((m) => [...m, { id: Date.now(), de_usuario: eu.id, para_usuario: outro.id, mensagem: t, criado_em: new Date().toISOString() }]);
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ de: eu.id, para: outro.id, mensagem: t }),
    }).catch(() => {});
    buscar();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={fechar}>
      <div
        className="bg-white dark:bg-[#202f36] w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col animate-bounceIn"
        style={{ height: "min(80vh, 600px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 p-4 border-b-2 border-gray-200 dark:border-[#37464f]">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-duo-blue flex items-center justify-center text-white font-extrabold">
              {outro.nome.charAt(0).toUpperCase()}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#202f36] ${outro.online ? "bg-duo-green" : "bg-gray-400"}`} />
          </div>
          <div className="flex-1">
            <p className="font-extrabold">{outro.nome}</p>
            <p className={`text-xs font-bold ${outro.online ? "text-duo-green" : "text-gray-400"}`}>
              {outro.online ? "Online" : "Offline"}
            </p>
          </div>
          <button onClick={fechar} className="text-2xl font-extrabold text-gray-400 hover:text-duo-red px-2" aria-label="Fechar chat">×</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {msgs.length === 0 && (
            <p className="text-center text-sm font-semibold text-gray-400 mt-8">
              Comece a conversa! 👋 Que tal combinar um desafio?
            </p>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.de_usuario === eu.id ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 font-semibold text-sm ${
                  m.de_usuario === eu.id
                    ? "bg-duo-blue text-white rounded-br-md"
                    : "bg-gray-100 dark:bg-[#2a3b44] rounded-bl-md"
                }`}
              >
                {m.mensagem}
                <div className={`text-[10px] mt-0.5 ${m.de_usuario === eu.id ? "text-blue-100" : "text-gray-400"}`}>
                  {new Date(m.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          <div ref={fimRef} />
        </div>

        <form onSubmit={enviar} className="p-3 border-t-2 border-gray-200 dark:border-[#37464f] flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite sua mensagem..."
            maxLength={500}
            className="flex-1 rounded-2xl border-2 border-gray-300 dark:border-[#37464f] bg-white dark:bg-[#131f24] px-4 py-2.5 font-semibold focus:outline-none focus:border-duo-blue"
          />
          <button type="submit" disabled={!texto.trim()} className="btn-blue !px-4 disabled:opacity-50">➤</button>
        </form>
      </div>
    </div>
  );
}

/* ================= MODAL DE DESAFIO ================= */
function ModalDesafio({ eu, alvo, fechar }: { eu: Usuario; alvo: UsuarioLista; fechar: () => void }) {
  const router = useRouter();
  const [capitulo, setCapitulo] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch("/api/desafios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "criar", desafianteId: eu.id, desafiadoId: alvo.id, capitulo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro ?? "Erro ao criar desafio.");
      router.push(`/duelo/${json.desafioId}`);
    } catch (e: any) {
      setErro(e.message);
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={fechar}>
      <div className="card max-w-sm w-full animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">⚔️</div>
          <h2 className="text-xl font-extrabold">Desafiar {alvo.nome}!</h2>
          <p className="text-sm font-semibold text-gray-400 mt-1">
            Escolha o capítulo do duelo. Vocês responderão as mesmas 10 perguntas — vence quem acertar mais!
          </p>
        </div>
        <select
          value={capitulo}
          onChange={(e) => setCapitulo(Number(e.target.value))}
          className="w-full rounded-2xl border-2 border-gray-300 dark:border-[#37464f] bg-white dark:bg-[#131f24] px-4 py-3 font-bold mb-4"
        >
          {CAPITULOS.map((c) => (
            <option key={c.numero} value={c.numero}>
              Capítulo {c.numero} — {c.titulo}
            </option>
          ))}
        </select>
        {erro && <p className="text-duo-red font-bold text-sm mb-3">{erro}</p>}
        <div className="grid gap-2">
          <button onClick={enviar} disabled={enviando} className="btn-green w-full disabled:opacity-60">
            {enviando ? "Enviando..." : "Enviar desafio 🚀"}
          </button>
          <button onClick={fechar} className="btn-ghost w-full">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
