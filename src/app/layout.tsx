import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Êxodo Quest — Aprenda Êxodo 1–20 jogando",
  description:
    "App gamificado estilo Duolingo para estudar os capítulos 1 a 20 do livro de Êxodo, com quiz, narração e tutor via WhatsApp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes do primeiro paint (evita flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('exodo-tema');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
