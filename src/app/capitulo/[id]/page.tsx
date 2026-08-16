"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCapitulo, PerguntaQuiz } from "@/data/capitulos";
import ThemeToggle from "@/components/ThemeToggle";
import HelpButton from "@/components/HelpButton";
import ProgressBar from "@/components/ProgressBar";
import TTSButton from "@/components/TTSButton";
import { useSessaoQuiz } from "@/lib/useSessao";

type Modo = "historia" | "resumo" | "quiz";
type VersaoHistoria = "original" | "simplificada";

interface Usuario {
  id: string;
  nome: string;
}

export default function PaginaCapitulo() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const numero = Number(params.id);
  const capitulo = useMemo(() => getCapitulo(numero), [numero]);

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [modo, setModo] = useState<Modo>("historia");

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("exodo-usuario");
      if (!salvo) {
        router.replace("/");
        return;
      }
      setUsuario(JSON.parse(salvo));
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!capitulo) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-xl font-extrabold">Capítulo não encontrado 😕</p>
        <Link href="/trilha" className="btn-blue">Voltar à trilha</Link>
      </main>
    );
  }
  if (!usuario) return null;

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 pb-24">
      <header className="sticky top-0 z-40 bg-[#f7f7f7]/90 dark:bg-[#131f24]/90 backdrop-blur py-4 flex items-center justify-between gap-3">
        <Link href="/trilha" className="font-extrabold text-duo-blue hover:underline" aria-label="Voltar à trilha">
          ← Trilha
        </Link>
        <h1 className="font-extrabold text-center text-sm sm:text-base">
          Cap. {capitulo.numero} — {capitulo.titulo}
        </h1>
        <ThemeToggle />
      </header>

      {/* Abas de modo */}
      <nav className="grid grid-cols-3 gap-2 my-4" aria-label="Modos de estudo">
        {(
          [
            ["historia", "📖 História"],
            ["resumo", "📝 Resumo"],
            ["quiz", "🎯 Quiz"],
          ] as [Modo, string][]
        ).map(([m, rotulo]) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={modo === m ? "btn-blue !px-2 text-sm" : "btn-ghost !px-2 text-sm"}
            aria-pressed={modo === m}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      {modo === "historia" && <ModoHistoria numero={numero} textoOriginal={capitulo.textoOriginal} interpretacaoManual={capitulo.interpretacao} />}
      {modo === "resumo" && <ModoResumo resumo={capitulo.resumo} />}
      {modo === "quiz" && <ModoQuiz capituloNumero={numero} quiz={capitulo.quiz} usuario={usuario} />}

      <HelpButton
        texto={
          "Como estudar este capítulo: 📚\n\n" +
          "📖 HISTÓRIA: leia o texto bíblico completo. Alterne entre o texto original (ARC) e a versão simplificada gerada por IA. Toque em 🔊 para ouvir a narração.\n\n" +
          "📝 RESUMO: versão curta com os fatos principais — as respostas do quiz estão aqui!\n\n" +
          "🎯 QUIZ: responda as perguntas. Verde = acertou, vermelho = errou. Complete o quiz para desbloquear o próximo capítulo!"
        }
      />
    </main>
  );
}

/* ================= HISTÓRIA COMPLETA ================= */
function ModoHistoria({
  numero,
  textoOriginal,
  interpretacaoManual,
}: {
  numero: number;
  textoOriginal: string;
  interpretacaoManual: string;
}) {
  const [versao, setVersao] = useState<VersaoHistoria>("original");
  const [interpretacao, setInterpretacao] = useState(interpretacaoManual);
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState("");

  async function carregarInterpretacao() {
    if (interpretacao) return;
    setGerando(true);
    setErroIA("");
    try {
      const res = await fetch("/api/ia/interpretacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capitulo: numero }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.erro ?? "Erro ao gerar interpretação.");
      setInterpretacao(json.interpretacao);
    } catch (e: any) {
      setErroIA(e.message);
    } finally {
      setGerando(false);
    }
  }

  useEffect(() => {
    if (versao === "simplificada") carregarInterpretacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao]);

  const texto = versao === "original" ? textoOriginal : interpretacao;

  return (
    <section className="animate-pop">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setVersao("original")}
          className={versao === "original" ? "btn-green !py-2 text-xs" : "btn-ghost !py-2 text-xs"}
        >
          Texto Original (ARC)
        </button>
        <button
          onClick={() => setVersao("simplificada")}
          className={versao === "simplificada" ? "btn-green !py-2 text-xs" : "btn-ghost !py-2 text-xs"}
        >
          ✨ Interpretação Simplificada (IA)
        </button>
        {texto && <TTSButton texto={texto} rotulo="Narrar" />}
      </div>

      <article className="card leading-relaxed whitespace-pre-line text-[16px]">
        {versao === "simplificada" && gerando && (
          <p className="font-bold text-duo-blue animate-pulse">
            ✨ Gerando interpretação simplificada com IA... aguarde alguns segundos.
          </p>
        )}
        {versao === "simplificada" && erroIA && (
          <div>
            <p className="text-duo-red font-bold">⚠️ {erroIA}</p>
            <button onClick={carregarInterpretacao} className="btn-blue mt-3 !py-2 text-sm">
              Tentar novamente
            </button>
          </div>
        )}
        {texto && !gerando && texto}
      </article>

      {/* Incentivo à leitura da Bíblia física */}
      <div className="mt-4 rounded-2xl border-2 border-duo-yellow bg-yellow-50 dark:bg-[#3a3110] p-4 flex items-start gap-3">
        <span className="text-2xl" aria-hidden>📖</span>
        <p className="text-sm font-semibold leading-relaxed">
          <span className="font-extrabold">Dica do tutor:</span> acompanhe este capítulo
          também na sua <span className="font-extrabold">Bíblia física</span>! O app é um
          ajudante para fixar o conteúdo — nada substitui abrir a Palavra, marcar os
          versículos e meditar nela. 🙏
        </p>
      </div>
    </section>
  );
}

/* ================= HISTÓRIA RESUMIDA ================= */
function ModoResumo({ resumo }: { resumo: string }) {
  return (
    <section className="animate-pop">
      <div className="mb-4">
        <TTSButton texto={resumo} rotulo="Ouvir Resumo" />
      </div>
      <article className="card leading-relaxed whitespace-pre-line text-[16px] !border-duo-purple">
        <p className="font-extrabold text-duo-purple text-sm uppercase tracking-wide mb-3">
          📝 Resumo — atenção: as respostas do quiz estão aqui!
        </p>
        {resumo}
      </article>
    </section>
  );
}

/* ================= QUIZ ================= */
function ModoQuiz({
  capituloNumero,
  quiz,
  usuario,
}: {
  capituloNumero: number;
  quiz: PerguntaQuiz[];
  usuario: Usuario;
}) {
  const { registrarResposta } = useSessaoQuiz();
  const [indice, setIndice] = useState(0);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [confirmada, setConfirmada] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [finalizado, setFinalizado] = useState(false);

  const pergunta = quiz[indice];

  function confirmar() {
    if (selecionada === null || confirmada) return;
    setConfirmada(true);

    const acertou = selecionada === pergunta.correta;
    if (acertou) setAcertos((a) => a + 1);

    // Grava no Supabase + renova a sessão (timer dos 10 min)
    registrarResposta({
      usuarioId: usuario.id,
      capitulo: capituloNumero,
      perguntaId: pergunta.id,
      resultado: acertou,
      respostaMarcada: selecionada,
    });
  }

  function proxima() {
    if (indice + 1 >= quiz.length) {
      setFinalizado(true);
      // Marca capítulo como concluído e desbloqueia o próximo
      try {
        const prog: number[] = JSON.parse(
          localStorage.getItem("exodo-capitulos-concluidos") ?? "[]"
        );
        if (!prog.includes(capituloNumero)) {
          prog.push(capituloNumero);
          localStorage.setItem("exodo-capitulos-concluidos", JSON.stringify(prog));
        }
      } catch {}
      return;
    }
    setIndice((i) => i + 1);
    setSelecionada(null);
    setConfirmada(false);
  }

  if (finalizado) {
    const pct = Math.round((acertos / quiz.length) * 100);
    return (
      <section className="animate-pop text-center card !p-8">
        <div className="text-6xl mb-4">{pct >= 70 ? "🏆" : "💪"}</div>
        <h2 className="text-2xl font-extrabold">
          {pct >= 70 ? "Capítulo concluído!" : "Bom esforço!"}
        </h2>
        <p className="mt-2 font-bold text-gray-500 dark:text-gray-300">
          Você acertou {acertos} de {quiz.length} perguntas ({pct}%).
        </p>
        <div className="my-6">
          <ProgressBar valor={acertos} total={quiz.length} cor={pct >= 70 ? "bg-duo-green" : "bg-duo-yellow"} />
        </div>
        <div className="grid gap-3">
          <Link href="/trilha" className="btn-green">Voltar à trilha →</Link>
          <button
            onClick={() => {
              setIndice(0);
              setSelecionada(null);
              setConfirmada(false);
              setAcertos(0);
              setFinalizado(false);
            }}
            className="btn-ghost"
          >
            Refazer quiz
          </button>
        </div>
      </section>
    );
  }

  const acertou = confirmada && selecionada === pergunta.correta;

  return (
    <section className="animate-pop">
      <div className="flex items-center gap-3 mb-5">
        <span className="font-extrabold text-sm text-gray-400">
          {indice + 1}/{quiz.length}
        </span>
        <div className="flex-1">
          <ProgressBar valor={indice + (confirmada ? 1 : 0)} total={quiz.length} />
        </div>
      </div>

      <h2 className="text-xl font-extrabold mb-5">{pergunta.pergunta}</h2>

      <div className="grid gap-3" role="radiogroup" aria-label="Alternativas">
        {pergunta.opcoes.map((opcao, i) => {
          let classe = "quiz-option";
          if (!confirmada && selecionada === i) classe += " quiz-option-selected";
          if (confirmada) {
            if (i === pergunta.correta) classe += " quiz-option-correct";
            else if (i === selecionada) classe += " quiz-option-wrong";
          }
          return (
            <button
              key={i}
              className={classe}
              onClick={() => !confirmada && setSelecionada(i)}
              disabled={confirmada}
              role="radio"
              aria-checked={selecionada === i}
            >
              <span className="inline-block w-7 h-7 mr-3 rounded-lg border-2 border-current text-center text-sm leading-6">
                {String.fromCharCode(65 + i)}
              </span>
              {opcao}
            </button>
          );
        })}
      </div>

      {/* Feedback imediato estilo Duolingo */}
      {confirmada && (
        <div
          className={`mt-5 rounded-2xl p-4 font-bold animate-bounceIn ${
            acertou
              ? "bg-green-100 text-duo-greenDark dark:bg-[#1c3a18] dark:text-duo-green"
              : "bg-red-100 text-duo-redDark dark:bg-[#451b1b] dark:text-duo-red"
          }`}
          role="status"
        >
          <p className="text-lg">{acertou ? "✅ Correto! Muito bem!" : "❌ Ops! Não foi dessa vez."}</p>
          {!acertou && (
            <p className="mt-1 text-sm">
              Resposta certa: <strong>{pergunta.opcoes[pergunta.correta]}</strong>
            </p>
          )}
          {pergunta.explicacao && <p className="mt-2 text-sm font-semibold opacity-90">{pergunta.explicacao}</p>}
        </div>
      )}

      <div className="mt-6">
        {!confirmada ? (
          <button onClick={confirmar} disabled={selecionada === null} className="btn-green w-full text-lg disabled:opacity-50">
            Confirmar
          </button>
        ) : (
          <button onClick={proxima} className={`${acertou ? "btn-green" : "btn-red"} w-full text-lg`}>
            {indice + 1 >= quiz.length ? "Ver resultado 🏁" : "Continuar →"}
          </button>
        )}
      </div>
    </section>
  );
}
