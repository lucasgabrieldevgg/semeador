"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Convite {
  id: string;
  desafiante_nome: string;
  capitulo: number;
}

/**
 * 🔔 Notificação de desafio: faz polling a cada 10s.
 * Quando alguém te desafia, aparece um banner animado em qualquer tela.
 */
export default function NotificacaoDesafio({ usuarioId }: { usuarioId: string }) {
  const router = useRouter();
  const [convite, setConvite] = useState<Convite | null>(null);
  const [ignorados, setIgnorados] = useState<string[]>([]);

  useEffect(() => {
    let ativo = true;
    async function verificar() {
      try {
        const res = await fetch(`/api/desafios?usuarioId=${usuarioId}`);
        const json = await res.json();
        if (!ativo) return;
        const pendente = (json?.pendentes_recebidos ?? []).find(
          (d: Convite) => !ignorados.includes(d.id)
        );
        setConvite(pendente ?? null);
      } catch {}
    }
    verificar();
    const i = setInterval(verificar, 10_000);
    return () => { ativo = false; clearInterval(i); };
  }, [usuarioId, ignorados]);

  if (!convite) return null;

  async function responder(aceitar: boolean) {
    if (!convite) return;
    await fetch("/api/desafios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: aceitar ? "aceitar" : "recusar", desafioId: convite.id }),
    }).catch(() => {});
    if (aceitar) {
      router.push(`/duelo/${convite.id}`);
    } else {
      setIgnorados((x) => [...x, convite.id]);
      setConvite(null);
    }
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-md animate-bounceIn">
      <div className="card !border-duo-yellow !bg-yellow-50 dark:!bg-[#3a3110] shadow-2xl !p-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl animate-bounce">⚔️</span>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold">
              {convite.desafiante_nome} te desafiou!
            </p>
            <p className="text-sm font-bold text-gray-500 dark:text-yellow-200">
              Duelo do Capítulo {convite.capitulo} · 10 perguntas
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={() => responder(true)} className="btn-green !py-2 text-sm">
            Aceitar! 🔥
          </button>
          <button onClick={() => responder(false)} className="btn-ghost !py-2 text-sm">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
