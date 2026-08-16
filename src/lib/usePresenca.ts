"use client";

import { useEffect } from "react";

/** Batimento de presença: marca o usuário como online a cada 30s. */
export function usePresenca(usuarioId: string | null) {
  useEffect(() => {
    if (!usuarioId) return;
    const bater = () =>
      fetch("/api/presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId }),
      }).catch(() => {});
    bater();
    const intervalo = setInterval(bater, 30_000);
    return () => clearInterval(intervalo);
  }, [usuarioId]);
}
