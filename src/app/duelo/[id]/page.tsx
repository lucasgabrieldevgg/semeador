"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCapitulo, PerguntaQuiz } from "@/data/capitulos";
import ThemeToggle from "@/components/ThemeToggle";
import HelpButton from "@/components/HelpButton";
import ProgressBar from "@/components/ProgressBar";
import { usePresenca } from "@/lib/usePresenca";

interface Usuario { id: string; nome: string }
interface Desafio {
  id: string;
  desafiante_id: string;
  desafiado_id: string;
  desafiante_nome: string;
  desafiado_nome: string;
  capitulo: number;
  status: string;
  total_perguntas: number;
  pontos_desafiante: number;
  pontos_desafiado: number;
  prog_desafiante: number;
  prog_desafiado: number;
  vencedor_id: string | null;
}

/** Embaralha de forma DETERMINÍSTICA pela seed (id do desafio):
 *  os dois jogadores veem as MESMAS perguntas na MESMA ordem. */
function embaralharComSeed<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const rnd = () => {
    h = Math.imul(48271, h) % 2147483647;
    return (h & 0x7fffffff) / 2147483647;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * ⚔️ ARENA DE DUELO — quiz competitivo 1x1 com placar ao vivo.
 */
export default function Duelo() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const desafioId = params.id;

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [desafio, setDesafio] = useState<Desafio | null>(null);
  const [erro, setErro] = useState("");

  // estado do quiz local
  const [indice, setIndice] = useState(0);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [confirmada, setConfirmada] = useState(false);
  const [meusPontos, setMeusPontos] = useState(0);
  const [terminei, setTerminei] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("exodo-usuario");
      if (!salvo) { router.replace("/"); return; }
      setUsuario(JSON.parse(salvo));
    } catch { router.replace("/"); }
  }, [router]);

  usePresenca(usuario?.id ?? null);

  const buscarEstado = useCallback(async () => {
    try {
      const res = await fetch(`/api/desafios/estado?id=${desafioId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro ?? "Desafio não encontrado.");
      setDesafio(json);
    } catch (e: any) {
      setErro(e.message);
    }
  }, [desafioId]);

  // polling do placar a cada 3s
  useEffect(() => {
    buscarEstado();
    const i = setInterval(buscarEstado, 3000);
    return () => clearInterval(i);
  }, [buscarEstado]);

  const capitulo = useMemo(
    () => (desafio ? getCapitulo(desafio.capitulo) : undefined),
    [desafio]
  );
  const perguntas: PerguntaQuiz[] = useMemo(() => {
    if (!capitulo || !desafio) return [];
    return embaralharComSeed(capitulo.quiz, desafio.id).slice(0, desafio.total_perguntas);
  }, [capitulo, desafio]);

  if (erro) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-xl font-extrabold">⚠️ {erro}</p>
        <Link href="/comunidade" className="btn-blue">Voltar à comunidade</Link>
      </main>
    );
  }
  if (!usuario || !desafio || !capitulo) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-extrabold text-gray-400 animate-pulse">Carregando duelo... ⚔️</p>
      </main>
    );
  }

  const souDesafiante = desafio.desafiante_id === usuario.id;
  const meuNome = souDesafiante ? desafio.desafiante_nome : desafio.desafiado_nome;
  const nomeOponente = souDesafiante ? desafio.desafiado_nome : desafio.desafiante_nome;
  const pontosOponente = souDesafiante ? desafio.pontos_desafiado : desafio.pontos_desafiante;
  const progOponente = souDesafiante ? desafio.prog_desafiado : desafio.prog_desafiante;
  const meuProgServidor = souDesafiante ? desafio.prog_desafiante : desafio.prog_desafiado;

  /* ---------- Aguardando aceite ---------- */
  if (desafio.status === "pendente") {
    return (
      <main className="min-h-screen max-w-lg mx-auto px-4 flex flex-col">
        <Cabecalho />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-6xl animate-bounce">⏳</div>
          <h1 className="text-2xl font-extrabold">
            {souDesafiante ? `Aguardando ${nomeOponente} aceitar...` : `${nomeOponente} te desafiou!`}
          </h1>
          <p className="font-bold text-gray-400">
            Capítulo {desafio.capitulo} — {capitulo.titulo} · {desafio.total_perguntas} perguntas
          </p>
          {!souDesafiante && (
            <div className="grid gap-3 w-full max-w-xs">
              <button
                className="btn-green"
                onClick={async () => {
                  await fetch("/api/desafios", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ acao: "aceitar", desafioId }),
                  });
                  buscarEstado();
                }}
              >
                Aceitar duelo ⚔️
              </button>
              <button
                className="btn-red"
                onClick={async () => {
                  await fetch("/api/desafios", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ acao: "recusar", desafioId }),
                  });
                  router.push("/comunidade");
                }}
              >
                Recusar
              </button>
            </div>
          )}
          {souDesafiante && (
            <Link href="/comunidade" className="btn-ghost">Voltar (o duelo continua valendo)</Link>
          )}
        </div>
      </main>
    );
  }

  if (desafio.status === "recusado") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-6xl">😅</div>
        <h1 className="text-2xl font-extrabold">{nomeOponente} recusou o desafio</h1>
        <Link href="/comunidade" className="btn-blue">Voltar à comunidade</Link>
      </main>
    );
  }

  /* ---------- Finalizado ---------- */
  const finalizadoServidor = desafio.status === "finalizado";
  if (finalizadoServidor || (terminei && progOponente >= desafio.total_perguntas)) {
    const meusPts = souDesafiante ? desafio.pontos_desafiante : desafio.pontos_desafiado;
    const venci = desafio.vencedor_id === usuario.id;
    const empate = desafio.vencedor_id === null && finalizadoServidor;
    return (
      <main className="min-h-screen max-w-lg mx-auto px-4 flex flex-col">
        <Cabecalho />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-7xl animate-bounceIn">{empate ? "🤝" : venci ? "🏆" : "💪"}</div>
          <h1 className="text-3xl font-extrabold">
            {empate ? "Empate!" : venci ? "Você venceu!" : `${nomeOponente} venceu!`}
          </h1>
          <div className="card w-full max-w-sm !p-6">
            <PlacarLinha nome={meuNome + " (você)"} pontos={meusPts} total={desafio.total_perguntas} destaque={venci} />
            <div className="my-3 border-t-2 border-gray-200 dark:border-[#37464f]" />
            <PlacarLinha nome={nomeOponente} pontos={pontosOponente} total={desafio.total_perguntas} destaque={!venci && !empate} />
          </div>
          <Link href="/comunidade" className="btn-green w-full max-w-sm">Voltar à comunidade</Link>
        </div>
      </main>
    );
  }

  /* ---------- Eu terminei, oponente ainda joga ---------- */
  if (terminei || meuProgServidor >= desafio.total_perguntas) {
    return (
      <main className="min-h-screen max-w-lg mx-auto px-4 flex flex-col">
        <Cabecalho />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-6xl animate-pulse">⏱️</div>
          <h1 className="text-2xl font-extrabold">Você terminou! Aguardando {nomeOponente}...</h1>
          <div className="card w-full max-w-sm !p-6">
            <PlacarLinha nome={meuNome + " (você)"} pontos={souDesafiante ? desafio.pontos_desafiante : desafio.pontos_desafiado} total={desafio.total_perguntas} />
            <div className="my-3 border-t-2 border-gray-200 dark:border-[#37464f]" />
            <PlacarLinha nome={`${nomeOponente} (${progOponente}/${desafio.total_perguntas})`} pontos={pontosOponente} total={desafio.total_perguntas} />
          </div>
          <p className="text-sm font-bold text-gray-400">O placar atualiza sozinho a cada 3 segundos.</p>
        </div>
      </main>
    );
  }

  /* ---------- Jogando ---------- */
  const pergunta = perguntas[indice];
  if (!pergunta) return null;
  const acertou = confirmada && selecionada === pergunta.correta;

  async function confirmar() {
    if (selecionada === null || confirmada || !pergunta) return;
    setConfirmada(true);
    const ok = selecionada === pergunta.correta;
    if (ok) setMeusPontos((p) => p + 1);
    await fetch("/api/desafios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "responder", desafioId, usuarioId: usuario!.id, acertou: ok }),
    }).catch(() => {});
    buscarEstado();
  }

  function proxima() {
    if (indice + 1 >= perguntas.length) { setTerminei(true); return; }
    setIndice((i) => i + 1);
    setSelecionada(null);
    setConfirmada(false);
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto px-4 pb-24">
      <Cabecalho />

      {/* Placar ao vivo */}
      <div className="card !p-3 mb-4 flex items-center justify-between gap-2 text-sm">
        <div className="text-center flex-1">
          <p className="font-extrabold truncate">{meuNome} (você)</p>
          <p className="text-2xl font-extrabold text-duo-green">{meusPontos}</p>
        </div>
        <div className="text-2xl font-extrabold text-gray-300">VS</div>
        <div className="text-center flex-1">
          <p className="font-extrabold truncate">{nomeOponente}</p>
          <p className="text-2xl font-extrabold text-duo-red">{pontosOponente}</p>
          <p className="text-[10px] font-bold text-gray-400">{progOponente}/{desafio.total_perguntas} respondidas</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <span className="font-extrabold text-sm text-gray-400">{indice + 1}/{perguntas.length}</span>
        <div className="flex-1">
          <ProgressBar valor={indice + (confirmada ? 1 : 0)} total={perguntas.length} cor="bg-duo-yellow" />
        </div>
      </div>

      <h2 className="text-xl font-extrabold mb-5">{pergunta.pergunta}</h2>

      <div className="grid gap-3">
        {pergunta.opcoes.map((opcao, i) => {
          let classe = "quiz-option";
          if (!confirmada && selecionada === i) classe += " quiz-option-selected";
          if (confirmada) {
            if (i === pergunta.correta) classe += " quiz-option-correct";
            else if (i === selecionada) classe += " quiz-option-wrong";
          }
          return (
            <button key={i} className={classe} onClick={() => !confirmada && setSelecionada(i)} disabled={confirmada}>
              <span className="inline-block w-7 h-7 mr-3 rounded-lg border-2 border-current text-center text-sm leading-6">
                {String.fromCharCode(65 + i)}
              </span>
              {opcao}
            </button>
          );
        })}
      </div>

      {confirmada && (
        <div className={`mt-5 rounded-2xl p-4 font-bold animate-bounceIn ${acertou ? "bg-green-100 text-duo-greenDark dark:bg-[#1c3a18] dark:text-duo-green" : "bg-red-100 text-duo-redDark dark:bg-[#451b1b] dark:text-duo-red"}`}>
          {acertou ? "✅ Ponto para você!" : `❌ Errou! Resposta: ${pergunta.opcoes[pergunta.correta]}`}
        </div>
      )}

      <div className="mt-6">
        {!confirmada ? (
          <button onClick={confirmar} disabled={selecionada === null} className="btn-green w-full text-lg disabled:opacity-50">
            Confirmar
          </button>
        ) : (
          <button onClick={proxima} className="btn-blue w-full text-lg">
            {indice + 1 >= perguntas.length ? "Finalizar 🏁" : "Próxima →"}
          </button>
        )}
      </div>

      <HelpButton
        texto={
          "Arena de Duelo ⚔️\n\n" +
          "• Você e seu oponente respondem as MESMAS 10 perguntas, na mesma ordem.\n" +
          "• Cada acerto vale 1 ponto. O placar do oponente atualiza ao vivo.\n" +
          "• Vence quem fizer mais pontos ao final. Empate é possível!\n\n" +
          "Dica: respostas do duelo não afetam suas estatísticas de estudo."
        }
      />
    </main>
  );

  function Cabecalho() {
    return (
      <header className="sticky top-0 z-40 bg-[#f7f7f7]/90 dark:bg-[#131f24]/90 backdrop-blur py-4 flex items-center justify-between gap-3">
        <Link href="/comunidade" className="font-extrabold text-duo-blue hover:underline">← Sair</Link>
        <h1 className="font-extrabold text-sm sm:text-base">⚔️ Duelo · Cap {desafio?.capitulo}</h1>
        <ThemeToggle />
      </header>
    );
  }
}

function PlacarLinha({ nome, pontos, total, destaque }: { nome: string; pontos: number; total: number; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className={`font-extrabold truncate ${destaque ? "text-duo-green" : ""}`}>{destaque ? "👑 " : ""}{nome}</p>
      <p className="text-xl font-extrabold shrink-0">{pontos}<span className="text-sm text-gray-400">/{total}</span></p>
    </div>
  );
}
