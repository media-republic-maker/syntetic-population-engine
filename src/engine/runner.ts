// ─────────────────────────────────────────────────────────────────────────────
// Silnik LLM – równoległe wywołania z rate limitingiem
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import type { Persona, AdMaterial, BotResponse } from "../personas/schema.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";

const MODEL = process.env.MODEL ?? "claude-sonnet-4-6";
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "5", 10);
const MAX_RETRIES = 2;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────────────────────────────────────
// Parser odpowiedzi JSON z fallbackiem
// ─────────────────────────────────────────────────────────────────────────────

function parseResponse(personaId: string, raw: string): BotResponse {
  // Wyciągnij JSON nawet jeśli model dodał komentarze
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Brak JSON w odpowiedzi modelu");

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    personaId,
    attentionScore: clamp(Number(parsed.attentionScore ?? 0), 0, 10),
    resonanceScore: clamp(Number(parsed.resonanceScore ?? 0), 0, 10),
    purchaseIntentDelta: clamp(Number(parsed.purchaseIntentDelta ?? 0), -5, 5),
    trustImpact: clamp(Number(parsed.trustImpact ?? 0), -5, 5),
    recall: String(parsed.recall ?? ""),
    womSimulation: String(parsed.womSimulation ?? ""),
    rejectionSignals: Array.isArray(parsed.rejectionSignals)
      ? parsed.rejectionSignals.map(String)
      : [],
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ─────────────────────────────────────────────────────────────────────────────
// Pojedyncze wywołanie dla jednej persony
// ─────────────────────────────────────────────────────────────────────────────

async function queryPersona(
  persona: Persona,
  ad: AdMaterial,
  attempt = 0
): Promise<BotResponse> {
  try {
    const userContent: Anthropic.MessageParam["content"] =
      ad.imageBase64 && ad.imageMimeType
        ? [
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: ad.imageMimeType,
                data: ad.imageBase64,
              },
            },
            { type: "text" as const, text: buildUserPrompt(ad) },
          ]
        : buildUserPrompt(ad);

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      temperature: 1.0,
      system: buildSystemPrompt(persona),
      messages: [{ role: "user", content: userContent }],
    });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return parseResponse(persona.id, raw);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(1000 * (attempt + 1));
      return queryPersona(persona, ad, attempt + 1);
    }
    console.error(`✗ Błąd dla persony ${persona.name} (${persona.id}):`, err);
    // Zwróć pusty wynik zamiast przerywać całe badanie
    return {
      personaId: persona.id,
      attentionScore: 0,
      resonanceScore: 0,
      purchaseIntentDelta: 0,
      trustImpact: 0,
      recall: "",
      womSimulation: "",
      rejectionSignals: ["ERROR: nie udało się uzyskać odpowiedzi"],
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Równoległy runner z rate limitingiem (pula CONCURRENCY wątków)
// ─────────────────────────────────────────────────────────────────────────────

export async function runStudy(
  population: Persona[],
  ad: AdMaterial,
  onProgress?: (done: number, total: number) => void
): Promise<BotResponse[]> {
  const results: BotResponse[] = [];
  const total = population.length;
  let done = 0;

  // Podziel na chunki po CONCURRENCY person
  for (let i = 0; i < total; i += CONCURRENCY) {
    const chunk = population.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((persona) => queryPersona(persona, ad))
    );
    results.push(...chunkResults);
    done += chunk.length;
    onProgress?.(Math.min(done, total), total);
  }

  return results;
}
