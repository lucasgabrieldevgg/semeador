"use client";

import { useEffect, useState } from "react";

interface Msg {
  id: number;
  mensagem: string;
  lida: boolean;
  criado_em: string;
  usuario_id: string | null;
}

/**
 * Avisos do tutor (Adalberto) dentro do app.
 * Busca mensagens_admin (diretas + broadcast) a cada 60s.
 */
export default function MensagensBanner({ usuarioId }: { usuarioId: string }) {
  const [mensagens, setMensagens] = useState<Msg[]>([]);

  useEffect(() => {
    let ativo = true;

    async function buscar() {
      try {
        const res = await fetch(`/api/mensagens?usuarioId=${usuarioId}`);
        const json = await res.json();
        if (ativo && json?.mensagens) {
          setMensagens(json.mensagens.filter((m: Msg) => !m.lida));
        }
      } catch {}
    }

    buscar();
    const intervalo = setInterval(buscar, 60_000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [usuarioId]);

  async function marcarLida(id: number) {
    setMensagens((prev) => prev.filter((m) => m.id !== id));
    await fetch("/api/mensagens", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagemId: id }),
    }).catch(() => {});
  }

  if (!mensagens.length) return null;

  return (
    <div className="space-y-3 mb-5">
      {mensagens.map((m) => (
        <div
          key={m.id}
          className="card !border-duo-yellow !bg-yellow-50 dark:!bg-[#3a3110] animate-bounceIn flex items-start gap-3"
        >
          <span className="text-2xl" aria-hidden>📣</span>
          <div className="flex-1">
            <p className="font-extrabold text-sm uppercase tracking-wide text-yellow-700 dark:text-duo-yellow">
              Mensagem do Tutor
            </p>
            <p className="mt-1 leading-relaxed">{m.mensagem}</p>
          </div>
          <button
            onClick={() => marcarLida(m.id)}
            className="text-sm font-bold text-yellow-700 dark:text-duo-yellow hover:underline shrink-0"
            aria-label="Marcar mensagem como lida"
          >
            ✓ Lida
          </button>
        </div>
      ))}
    </div>
  );
}
