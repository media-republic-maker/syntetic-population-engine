// ─────────────────────────────────────────────────────────────────────────────
// Silnik LLM – równoległe wywołania z rate limitingiem
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import type { Persona, AdMaterial, BotResponse } from "../personas/schema.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";

const MODEL = process.env.MODEL ?? "claude-sonnet-4-6";
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "5", 10);
const MAX_RETRIES = 3;

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

// ─────────────────────────────────────────────────────────────────────────────
// Globalny semaphore rate-limit: kiedy dostaniemy 429, wstrzymaj nowe żądania
// ─────────────────────────────────────────────────────────────────────────────

let rateLimitUntil = 0;

async function waitForRateLimit(): Promise<void> {
  const wait = rateLimitUntil - Date.now();
  if (wait > 0) await sleep(wait);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryPersona(
  persona: Persona,
  ad: AdMaterial,
  attempt = 0
): Promise<BotResponse> {
  await waitForRateLimit();

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
  } catch (err: any) {
    // Rate limit (429) – wstrzymaj wszystkie workery i poczekaj
    if (err?.status === 429 || err?.type === "rate_limit_error") {
      const retryAfter = parseInt(err?.headers?.["retry-after"] ?? "0", 10);
      const backoff = retryAfter > 0 ? retryAfter * 1000 : Math.min(5000 * 2 ** attempt, 60000);
      rateLimitUntil = Math.max(rateLimitUntil, Date.now() + backoff);
      console.warn(`⚠ Rate limit – czekam ${Math.round(backoff / 1000)}s (attempt ${attempt + 1})`);
      if (attempt < MAX_RETRIES) {
        await sleep(backoff);
        return queryPersona(persona, ad, attempt + 1);
      }
    }

    if (attempt < MAX_RETRIES) {
      // Inne błędy – krótki backoff
      await sleep(1000 * (attempt + 1));
      return queryPersona(persona, ad, attempt + 1);
    }

    console.error(`✗ Błąd dla persony ${persona.name} (${persona.id}):`, (err as Error).message ?? err);
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

// ─────────────────────────────────────────────────────────────────────────────
// Worker pool – CONCURRENCY workerów działa zawsze, nie czeka na najwolniejszego
// Zamiast batch: start 20 → czekaj na WSZYSTKIE 20 → start następne 20
// Teraz: skończyło 1 → od razu startuje następne (idle = 0)
// ─────────────────────────────────────────────────────────────────────────────

export async function runStudy(
  population: Persona[],
  ad: AdMaterial,
  onProgress?: (done: number, total: number) => void
): Promise<BotResponse[]> {
  const total = population.length;
  const results: BotResponse[] = new Array(total);
  let nextIdx = 0;
  let doneCount = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = nextIdx++;
      if (idx >= total) return;
      results[idx] = await queryPersona(population[idx], ad);
      doneCount++;
      onProgress?.(doneCount, total);
    }
  }

  const poolSize = Math.min(CONCURRENCY, total);
  await Promise.all(Array.from({ length: poolSize }, worker));

  return results;
}
