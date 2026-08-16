"use client";

import { useCallback, useEffect, useRef } from "react";

/* ============================================================
 * MONITOR DE SESSÃO (lado client) — LÓGICA DOS 10 MINUTOS
 * ------------------------------------------------------------
 * 1. Cada resposta de quiz renova o timer de inatividade;
 * 2. Se passarem 10 min sem responder => POST /api/sessao/flush
 *    (o backend consolida os logs e dispara o webhook da Zapia);
 * 3. Se o usuário fechar a aba/app => navigator.sendBeacon envia
 *    o flush com motivo "fechamento" (envio imediato);
 * 4. O cron /api/cron/verifica-sessoes cobre falhas do client.
 * ============================================================ */

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos
const STORAGE_KEY = "exodo-sessao-id";

export function useSessaoQuiz() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSessaoId = () => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const setSessaoId = (id: string | null) => {
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  /** Encerra a sessão e dispara o relatório no backend */
  const flush = useCallback(async (motivo: "timeout" | "fechamento") => {
    const sessaoId = getSessaoId();
    if (!sessaoId) return;

    const payload = JSON.stringify({ sessaoId, motivo });

    if (motivo === "fechamento" && typeof navigator !== "undefined" && navigator.sendBeacon) {
      // sendBeacon garante o envio mesmo com a aba fechando
      navigator.sendBeacon(
        "/api/sessao/flush",
        new Blob([payload], { type: "application/json" })
      );
    } else {
      await fetch("/api/sessao/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
    setSessaoId(null);
  }, []);

  /** (Re)inicia o timer de 10 minutos de inatividade */
  const renovarTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush("timeout"), TIMEOUT_MS);
  }, [flush]);

  /**
   * Registra uma resposta do quiz no backend.
   * Cria/renova a sessão e reinicia o timer dos 10 minutos.
   */
  const registrarResposta = useCallback(
    async (params: {
      usuarioId: string;
      capitulo: number;
      perguntaId: string;
      resultado: boolean;
      respostaMarcada?: number; // índice da alternativa marcada (0=A..3=D)
    }) => {
      try {
        const res = await fetch("/api/quiz/responder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...params, sessaoId: getSessaoId() }),
        });
        const json = await res.json();
        if (json?.sessaoId) setSessaoId(json.sessaoId);
        renovarTimer();
        return json;
      } catch (e) {
        console.error("Falha ao registrar resposta:", e);
        return null;
      }
    },
    [renovarTimer]
  );

  // Fechamento do app/aba => flush imediato via sendBeacon
  useEffect(() => {
    const aoFechar = () => flush("fechamento");
    window.addEventListener("pagehide", aoFechar);
    return () => {
      window.removeEventListener("pagehide", aoFechar);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flush]);

  return { registrarResposta };
}
