"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botão de Text-to-Speech (Narrar/Ouvir) usando a Web Speech API
 * nativa do navegador (gratuita, sem custo de API).
 */
export default function TTSButton({ texto, rotulo = "Ouvir" }: { texto: string; rotulo?: string }) {
  const [falando, setFalando] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function alternar() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Seu navegador não suporta narração de voz.");
      return;
    }
    const synth = window.speechSynthesis;

    if (falando) {
      synth.cancel();
      setFalando(false);
      return;
    }

    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    u.rate = 0.95;
    const vozPt = synth.getVoices().find((v) => v.lang.startsWith("pt"));
    if (vozPt) u.voice = vozPt;
    u.onend = () => setFalando(false);
    u.onerror = () => setFalando(false);
    utterRef.current = u;
    synth.cancel();
    synth.speak(u);
    setFalando(true);
  }

  return (
    <button
      onClick={alternar}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold border-2 border-b-4 transition-all
        active:border-b-2 active:translate-y-0.5
        ${
          falando
            ? "bg-duo-red border-duo-redDark text-white"
            : "bg-duo-blue border-duo-blueDark text-white"
        }`}
      aria-label={falando ? "Parar narração" : `Narrar: ${rotulo}`}
    >
      {falando ? "⏹ Parar" : `🔊 ${rotulo}`}
    </button>
  );
}
