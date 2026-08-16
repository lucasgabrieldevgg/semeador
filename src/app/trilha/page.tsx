"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CAPITULOS } from "@/data/capitulos";
import ThemeToggle from "@/components/ThemeToggle";
import HelpButton from "@/components/HelpButton";
import ProgressBar from "@/components/ProgressBar";
import MensagensBanner from "@/components/MensagensBanner";
import NotificacaoDesafio from "@/components/NotificacaoDesafio";
import { usePresenca } from "@/lib/usePresenca";

interface Usuario {
  id: string;
  nome: string;
}

/**
 * TRILHA LINEAR — Capítulos 1 a 20 (estilo mapa do Duolingo)
 */
export default function Trilha() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [concluidos, setConcluidos] = useState<number[]>([]);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("exodo-usuario");
      if (!salvo) {
        router.replace("/");
        return;
      }
      setUsuario(JSON.parse(salvo));
      const prog = localStorage.getItem("exodo-capitulos-concluidos");
      if (prog) setConcluidos(JSON.parse(prog));
    } catch {
      router.replace("/");
    }
  }, [router]);

  function sair() {
    localStorage.removeItem("exodo-usuario");
    router.push("/");
  }

  usePresenca(usuario?.id ?? null);

  if (!usuario) return null;

  const ICONES = ["📜", "👶", "🔥", "🐍", "👑", "🤝", "🩸", "🐸", "⛈️", "🦗",
                  "🌑", "🐑", "🕯️", "🌊", "🎵", "🍞", "💧", "👨‍⚖️", "⛰️", "📋"];

  return (
    <main className="min-h-screen max-w-lg mx-auto px-4 pb-24">
      <header className="sticky top-0 z-40 bg-[#f7f7f7]/90 dark:bg-[#131f24]/90 backdrop-blur py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">
            Olá, <span className="text-duo-green">{usuario.nome}</span>! 👋
          </h1>
          <p className="text-sm font-bold text-gray-400">
            {concluidos.length}/20 capítulos concluídos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={sair} className="btn-ghost !px-3 !py-2 text-sm" title="Sair">
            Sair
          </button>
        </div>
      </header>

      <div className="my-4">
        <ProgressBar valor={concluidos.length} total={20} />
      </div>

      {/* Atalhos: Revisão Inteligente + Comunidade */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link
          href="/revisao"
          className="card !border-duo-purple !p-4 text-center hover:scale-[1.02] transition-transform"
        >
          <div className="text-3xl">🧠</div>
          <p className="font-extrabold text-sm mt-1">Revisão Inteligente</p>
          <p className="text-[11px] font-bold text-gray-400">Treine o que você errou</p>
        </Link>
        <Link
          href="/comunidade"
          className="card !border-duo-yellow !p-4 text-center hover:scale-[1.02] transition-transform"
        >
          <div className="text-3xl">⚔️</div>
          <p className="font-extrabold text-sm mt-1">Comunidade</p>
          <p className="text-[11px] font-bold text-gray-400">Chat e duelos com amigos</p>
        </Link>
      </div>

      <MensagensBanner usuarioId={usuario.id} />
      <NotificacaoDesafio usuarioId={usuario.id} />

      {/* Incentivo à leitura da Bíblia física */}
      <div className="mb-4 rounded-2xl border-2 border-duo-yellow bg-yellow-50 dark:bg-[#3a3110] p-4 flex items-start gap-3">
        <span className="text-2xl" aria-hidden>📖</span>
        <p className="text-sm font-semibold leading-relaxed">
          <span className="font-extrabold">Lembrete:</span> este app te ajuda a estudar,
          mas leia também na sua <span className="font-extrabold">Bíblia física</span>!
          Abra Êxodo, acompanhe os capítulos e marque seus versículos favoritos. 🙏
        </p>
      </div>

      {/* Trilha em zigue-zague — todos os capítulos liberados */}
      <div className="relative mt-8 space-y-6">
        {CAPITULOS.map((cap, i) => {
          const concluido = concluidos.includes(cap.numero);
          const offset = ["ml-0", "ml-16", "ml-28", "ml-16"][i % 4];

          return (
            <div key={cap.numero} className={`flex ${offset} transition-all`}>
              <Link
                href={`/capitulo/${cap.numero}`}
                className="group flex items-center gap-4"
                aria-label={`Capítulo ${cap.numero}: ${cap.titulo}`}
              >
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl
                    border-b-8 transition-all group-active:border-b-2 group-active:translate-y-1
                    ${
                      concluido
                        ? "bg-duo-yellow border-yellow-600"
                        : "bg-duo-green border-duo-greenDark"
                    }`}
                >
                  {concluido ? "⭐" : ICONES[i]}
                </div>
                <div>
                  <p className="font-extrabold">Capítulo {cap.numero}</p>
                  <p className="text-sm font-semibold text-gray-400 max-w-[180px]">
                    {cap.titulo}
                  </p>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <HelpButton
        texto={
          "Esta é a sua trilha de estudos! 🗺️\n\n" +
          "• Todos os capítulos estão liberados — estude na ordem que quiser.\n" +
          "• Toque em um capítulo para ler a história, o resumo e fazer o quiz.\n" +
          "• Capítulos com ⭐ já foram concluídos.\n" +
          "• Mensagens amarelas 📣 são avisos do seu tutor.\n\n" +
          "A barra verde no topo mostra seu progresso geral."
        }
      />
    </main>
  );
}
