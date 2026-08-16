import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com SERVICE_ROLE_KEY.
 * USO EXCLUSIVO NO SERVIDOR (rotas de API). Nunca importe em componentes client.
 * A service role ignora RLS — por isso as tabelas ficam 100% bloqueadas
 * para a anon key e todo acesso passa pelas nossas APIs.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local"
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Evita o cache de fetch do Next.js — dados sempre frescos
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return _client;
}
