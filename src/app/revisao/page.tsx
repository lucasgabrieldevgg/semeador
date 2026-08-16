"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCapitulo, PerguntaQuiz } from "@/data/capitulos";
import ThemeToggle from "@/components/ThemeToggle";
import HelpButton from "@/components/HelpButton";
import ProgressBar from "@/components/ProgressBar";
import { useSessaoQuiz } from "@/lib/useSessao";
import { usePresenca } from "@/lib/usePresenca";

interface Usuario { id: string; nome: string }
interface ItemRevisao { pergunta_id: string; capitulo: number; erros: number; pendente: boolean }

/**
 * 🧠 REVISÃO INTELIGENTE
 * Treino personalizado com as perguntas que o aluno já errou
 * (repetição espaçada simplificada — domina quando acerta de novo).
 */
export default function Revisao() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [itens, setItens] = useState<ItemRevisao[] | null>(null);
  const { registrarResposta } = useSessaoQuiz();

  const [indice, setIndice] = useState(0);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [confirmada, setConfirmada] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [fim, setFim] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("exodo-usuario");
      if (!salvo) { router.replace("/"); return; }
      setUsuario(JSON.parse(salvo));
    } catch { router.replace("/"); }
  }, [router]);

  usePresenca(usuario?.id ?? null);

  useEffect(() => {
    if (!usuario) return;
    fetch(`/api/revisao?usuarioId=${usuario.id}`)
      .then((r) => r.json())
      .then((j) => setItens(j?.perguntas ?? []))
      .catch(() => setItens([]));
  }, [usuario]);

  // resolve as perguntas reais a partir dos IDs
  const perguntas: (PerguntaQuiz & { capitulo: number })[] = useMemo(() => {
    if (!itens) return [];
    const out: (PerguntaQuiz & { capitulo: number })[] = [];
    for (const item of itens) {
      const cap = getCapitulo(item.capitulo);
      const q = cap?.quiz.find((q) => q.id === item.pergunta_id);
      if (q) out.push({ ...q, capitulo: item.capitulo });
    }
    return out;
  }, [itens]);

  if (!usuario) return null;

  if (itens === null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-extrabold text-gray-400 animate-pulse">Montando sua revisão... 🧠</p>
      </main>
    );
  }

  if (perguntas.length === 0) {
    return (
      <main className="min-h-screen max-w-lg mx-auto px-4 flex flex-col">
        <Cabecalho />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-7xl">🎉</div>
          <h1 className="text-2xl font-extrabold">Nada para revisar!</h1>
          <p className="font-bold text-gray-400 max-w-xs">
            Você não tem perguntas erradas pendentes. Continue estudando os capítulos para manter o ritmo!
          </p>
          <Link href="/trilha" className="btn-green">Ir para a trilha →</Link>
        </div>
      </main>
    );
  }

  if (fim) {
    const pct = Math.round((acertos / perguntas.length) * 100);
    return (
      <main className="min-h-screen max-w-lg mx-auto px-4 flex flex-col">
        <Cabecalho />
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-7xl animate-bounceIn">{pct >= 70 ? "🧠✨" : "💪"}</div>
          <h1 className="text-2xl font-extrabold">Revisão concluída!</h1>
          <p className="font-bold text-gray-400">
            Você dominou {acertos} de {perguntas.length} perguntas que errava ({pct}%).
          </p>
          <div className="w-full max-w-sm">
            <ProgressBar valor={acertos} total={perguntas.length} cor="bg-duo-purple" />
          </div>
          <p className="text-sm font-semibold text-gray-400 max-w-xs">
            As que você acertou saem da fila de revisão. As que errou voltarão amanhã — é assim que a memória fixa! 🧠
          </p>
          <Link href="/trilha" className="btn-green w-full max-w-sm">Voltar à trilha</Link>
        </div>
      </main>
    );
  }

  const pergunta = perguntas[indice];
  const acertou = confirmada && selecionada === pergunta.correta;

  function confirmar() {
    if (selecionada === null || confirmada) return;
    setConfirmada(true);
    const ok = selecionada === pergunta.correta;
    if (ok) setAcertos((a) => a + 1);
    // grava no log normal — alimenta estatísticas e a própria revisão futura
    registrarResposta({
      usuarioId: usuario!.id,
      capitulo: pergunta.capitulo,
      perguntaId: pergunta.id,
      resultado: ok,
      respostaMarcada: selecionada ?? undefined,
    });
  }

  function proxima() {
    if (indice + 1 >= perguntas.length) { setFim(true); return; }
    setIndice((i) => i + 1);
    setSelecionada(null);
    setConfirmada(false);
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto px-4 pb-24">
      <Cabecalho />

      <div className="card !border-duo-purple !p-3 mb-4 flex items-center gap-3">
        <span className="text-2xl">🧠</span>
        <p className="text-sm font-bold">
          Treinando o que você errou — Cap {pergunta.capitulo}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <span className="font-extrabold text-sm text-gray-400">{indice + 1}/{perguntas.length}</span>
        <div className="flex-1">
          <ProgressBar valor={indice + (confirmada ? 1 : 0)} total={perguntas.length} cor="bg-duo-purple" />
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
          <p className="text-lg">{acertou ? "✅ Agora você dominou!" : "❌ Ainda não foi dessa vez."}</p>
          {!acertou && (
            <p className="mt-1 text-sm">Resposta certa: <strong>{pergunta.opcoes[pergunta.correta]}</strong></p>
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
            {indice + 1 >= perguntas.length ? "Concluir revisão 🏁" : "Continuar →"}
          </button>
        )}
      </div>

      <HelpButton
        texto={
          "Revisão Inteligente 🧠\n\n" +
          "Este modo treina exatamente as perguntas que VOCÊ errou nos quizzes.\n\n" +
          "• Acertou aqui? A pergunta sai da fila — você a dominou!\n" +
          "• Errou de novo? Ela volta na próxima revisão.\n\n" +
          "Estudos mostram que revisar os próprios erros é o jeito mais rápido de memorizar. Faça uma revisão por dia!"
        }
      />
    </main>
  );

  function Cabecalho() {
    return (
      <header className="sticky top-0 z-40 bg-[#f7f7f7]/90 dark:bg-[#131f24]/90 backdrop-blur py-4 flex items-center justify-between gap-3">
        <Link href="/trilha" className="font-extrabold text-duo-blue hover:underline">← Trilha</Link>
        <h1 className="font-extrabold">🧠 Revisão Inteligente</h1>
        <ThemeToggle />
      </header>
    );
  }
}
