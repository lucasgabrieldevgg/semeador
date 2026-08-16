"use client";

import { useState } from "react";

/**
 * Botão flutuante de "Modo Ajuda" — presente em todas as telas.
 * Recebe o texto explicativo específico de cada tela.
 */
export default function HelpButton({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        aria-label="Abrir modo ajuda"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-duo-blue border-b-4 border-duo-blueDark
                   text-white text-2xl font-extrabold shadow-lg flex items-center justify-center
                   active:border-b-0 active:translate-y-1 transition-all"
        title="Modo Ajuda"
      >
        ?
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setAberto(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card max-w-md w-full animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🦉</span>
              <h2 className="text-xl font-extrabold">Modo Ajuda</h2>
            </div>
            <p className="leading-relaxed whitespace-pre-line text-[15px]">{texto}</p>
            <button className="btn-blue w-full mt-5" onClick={() => setAberto(false)}>
              Entendi!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
