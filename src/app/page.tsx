"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import HelpButton from "@/components/HelpButton";

/**
 * TELA INICIAL (Onboarding)
 * - Cadastro pelo nome no primeiro acesso;
 * - 🔑 BACKDOOR: "adalberto" ou "batalha2026" => /admin-dashboard.
 */
export default function Onboarding() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // Se já tem usuário salvo, pula direto para a trilha
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("exodo-usuario");
      if (salvo) router.replace("/trilha");
    } catch {}
  }, [router]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 2) {
      setErro("Digite um nome com pelo menos 2 letras.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeLimpo }),
      });
      const json = await res.json();

      if (!res.ok) {
        setErro(json?.erro ?? "Erro ao entrar. Tente novamente.");
        return;
      }

      // 🔑 Backdoor de admin
      if (json.admin) {
        router.push("/admin-dashboard");
        return;
      }

      localStorage.setItem("exodo-usuario", JSON.stringify(json.usuario));
      router.push("/trilha");
    } catch {
      setErro("Falha de conexão. Verifique sua internet.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="text-7xl mb-4 animate-bounceIn" aria-hidden>🔥</div>
        <h1 className="text-4xl font-extrabold text-center">
          Êxodo <span className="text-duo-green">Quest</span>
        </h1>
        <p className="mt-3 text-center max-w-sm text-gray-500 dark:text-gray-300 font-semibold">
          Aprenda os capítulos 1 a 20 de Êxodo jogando, no estilo das suas
          lições favoritas. 🎮📖
        </p>

        <form onSubmit={entrar} className="w-full max-w-sm mt-10 space-y-4">
          <label htmlFor="nome" className="block font-extrabold text-sm uppercase tracking-wide">
            Como você se chama?
          </label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Digite seu nome..."
            autoComplete="off"
            className="w-full rounded-2xl border-2 border-gray-300 dark:border-[#37464f]
                       bg-white dark:bg-[#202f36] px-5 py-4 text-lg font-bold
                       focus:outline-none focus:border-duo-blue transition-colors"
          />
          {erro && (
            <p className="text-duo-red font-bold text-sm animate-pop" role="alert">
              {erro}
            </p>
          )}
          <button type="submit" disabled={carregando} className="btn-green w-full text-lg disabled:opacity-60">
            {carregando ? "Entrando..." : "Começar 🚀"}
          </button>
        </form>
      </div>

      <HelpButton
        texto={
          "Bem-vindo ao Êxodo Quest! 👋\n\n" +
          "1. Digite seu nome e toque em COMEÇAR.\n" +
          "2. Você verá a trilha com os capítulos 1 a 20 de Êxodo.\n" +
          "3. Em cada capítulo: leia (ou ouça!) a história, o resumo e responda o quiz.\n\n" +
          "Verde = acertou ✅ | Vermelho = errou ❌\n" +
          "Use o botão 🌙/☀️ para trocar entre modo claro e escuro."
        }
      />
    </main>
  );
}
