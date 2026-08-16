import { NextResponse } from "next/server";
import { gerarInterpretacaoSimplificada } from "@/lib/ia";
import { getCapitulo } from "@/data/capitulos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cache simples em memória para não gastar cota da API a cada acesso
const cache = new Map<number, string>();

/**
 * POST /api/ia/interpretacao
 * Gera a "Interpretação Simplificada" de um capítulo via IA (ChatAnywhere).
 * Body: { capitulo: number }
 */
export async function POST(req: Request) {
  try {
    const { capitulo } = await req.json();
    const num = Number(capitulo);

    const cap = getCapitulo(num);
    if (!cap) {
      return NextResponse.json({ erro: "Capítulo inválido." }, { status: 400 });
    }

    // Se já houver interpretação manual no arquivo de dados, usa ela
    if (cap.interpretacao?.trim()) {
      return NextResponse.json({ interpretacao: cap.interpretacao, origem: "manual" });
    }

    if (cache.has(num)) {
      return NextResponse.json({ interpretacao: cache.get(num), origem: "cache" });
    }

    const texto = await gerarInterpretacaoSimplificada(num, cap.textoOriginal);
    cache.set(num, texto);

    return NextResponse.json({ interpretacao: texto, origem: "ia" });
  } catch (e: any) {
    console.error("[api/ia/interpretacao]", e);
    return NextResponse.json(
      { erro: e?.message ?? "Erro ao gerar interpretação." },
      { status: 500 }
    );
  }
}
