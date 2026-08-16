/**
 * Cliente da API de IA (ChatAnywhere — protocolo OpenAI).
 * Usado para gerar a "Interpretação Simplificada" dos capítulos.
 * Variáveis: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
 */
export async function gerarInterpretacaoSimplificada(
  capitulo: number,
  textoOriginal: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.chatanywhere.tech/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no .env.local");
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "Você é um professor de Bíblia carismático que explica histórias para jovens e adultos de forma simples, " +
            "envolvente e fiel ao texto. Use português do Brasil, frases curtas, linguagem atual (sem gírias excessivas) " +
            "e mantenha todos os fatos do capítulo. Não invente doutrinas. Estruture em parágrafos curtos.",
        },
        {
          role: "user",
          content:
            `Reescreva o capítulo ${capitulo} de Êxodo abaixo (versão ARC) como uma "Interpretação Simplificada", ` +
            `mantendo todos os acontecimentos importantes:\n\n${textoOriginal}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Erro na API de IA (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const texto = json?.choices?.[0]?.message?.content;
  if (!texto) throw new Error("Resposta vazia da API de IA.");
  return texto;
}
