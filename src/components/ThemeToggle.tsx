"use client";

import { useEffect, useState } from "react";

/** Botão de alternância Modo Claro / Modo Escuro */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !dark;
    setDark(novo);
    document.documentElement.classList.toggle("dark", novo);
    try {
      localStorage.setItem("exodo-tema", novo ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      onClick={alternar}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      className="w-11 h-11 rounded-2xl border-2 border-b-4 border-gray-300 dark:border-[#37464f]
                 bg-white dark:bg-[#202f36] text-xl flex items-center justify-center
                 active:border-b-2 active:translate-y-0.5 transition-all"
      title="Alternar tema"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
