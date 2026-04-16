// ─────────────────────────────────────────────────────────────────────────────
// Generator populacji syntetycznej
// Tworzy N person z rozkładami zgodnymi z polską strukturą demograficzną
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import type { Persona } from "./schema.js";
import {
  weightedRandom,
  normalInt,
  sampleAge,
  sampleGender,
  sampleEducation,
  sampleSettlementType,
  sampleRegion,
  sampleHousehold,
  sampleIncomeLevel,
  sampleOwnsProperty,
  samplePoliticalAffiliation,
  sampleMediaHabits,
  sampleCommunicationStyles,
  sampleProductCategories,
  sampleName,
} from "./distributions.js";
import { assignBrandMemory } from "./brandMemory.js";

function generatePersona(): Persona {
  const gender = sampleGender();
  const age = sampleAge();

  // Wykształcenie warunkowane wiekiem (structural zero: 18-21 → "higher" rzadkie)
  const education = sampleEducation(age);
  const settlementType = sampleSettlementType();
  const region = sampleRegion();
  // Dochód warunkowany wiekiem + edukacją + lokalizacją (peak earnings 35–54)
  const incomeLevel = sampleIncomeLevel(education, settlementType, age);
  // Polityka warunkowana wiekiem + lokalizacją + wykształceniem (CBOS 2025)
  const affiliation = samplePoliticalAffiliation(age, settlementType, education);

  // ── OCEAN – pełna macierz korelacji (spec §1.1, §1.3) ─────────────────────
  // Openness: wykształcenie, wiek (młodsi otwarci), metropolia, liberalna polityka
  const opennessBase =
    { primary: -12, vocational: -6, secondary: 0, higher: 12 }[education]
    + (age < 30 ? 5 : age > 60 ? -5 : 0)
    + { village: -4, small_city: -2, medium_city: 0, large_city: 3, metropolis: 6 }[settlementType]
    + (["ko", "lewica"].includes(affiliation) ? 5 : ["pis", "konfederacja"].includes(affiliation) ? -5 : 0);

  // Conscientiousness: rośnie z wiekiem, wyższe w wyższym wykształceniu (meta-analiza Roberts 2006)
  const conscientiousnessBase =
    (age > 50 ? 8 : age > 35 ? 4 : age < 25 ? -5 : 0)
    + { primary: -4, vocational: 0, secondary: 2, higher: 5 }[education];

  // Extraversion: wyższe w miastach, niższe z wiekiem, wyższe u kobiet (marginalnie)
  const extraversionBase =
    { village: -4, small_city: -2, medium_city: 0, large_city: 3, metropolis: 5 }[settlementType]
    + (age > 55 ? -5 : age < 30 ? 3 : 0)
    + (gender === "female" ? 2 : 0);

  // Agreeableness: wyższe u kobiet (literatura Big 5), spada przy prawicy skrajnej
  const agreeablenessBase =
    (gender === "female" ? 7 : 0)
    + (affiliation === "konfederacja" ? -8 : affiliation === "pis" ? -3 : affiliation === "lewica" ? 4 : 0)
    + (age > 50 ? 3 : 0);

  // Neuroticism: wyższe u kobiet, wyższe przy niskim dochodzie, nieco niższe z wiekiem po 50
  const neuroticismBase =
    (gender === "female" ? 5 : 0)
    + { below_2000: 8, "2000_3500": 3, "3500_5000": 0, "5000_8000": -3, above_8000: -5 }[incomeLevel]
    + (age > 50 ? -4 : age < 30 ? 3 : 0);

  const persona: Persona = {
    id: randomUUID(),
    name: sampleName(gender),
    demographic: {
      age,
      gender,
      education,
      region,
      settlementType,
      householdType: sampleHousehold(age, gender),
    },
    financial: {
      incomeLevel,
      ownsProperty: sampleOwnsProperty(age, incomeLevel),
      hasSavings: Math.random() < (incomeLevel === "below_2000" ? 0.2 : incomeLevel === "above_8000" ? 0.8 : 0.45),
      hasDebt: Math.random() < (age > 30 && age < 55 ? 0.45 : 0.25),
      creditAttitude: weightedRandom([["positive", 25], ["neutral", 40], ["negative", 35]]),
      priceSensitivity: normalInt(
        incomeLevel === "below_2000" ? 75 : incomeLevel === "above_8000" ? 35 : 55,
        15, 0, 100
      ),
    },
    psychographic: {
      ocean: {
        openness:          normalInt(50 + opennessBase,          18, 0, 100),
        conscientiousness: normalInt(55 + conscientiousnessBase, 18, 0, 100),
        extraversion:      normalInt(50 + extraversionBase,      20, 0, 100),
        agreeableness:     normalInt(55 + agreeablenessBase,     18, 0, 100),
        neuroticism:       normalInt(45 + neuroticismBase,       18, 0, 100),
      },
      riskTolerance: normalInt(age < 35 ? 55 : 40, 18, 0, 100),
      // Traditionalism: wiek, wykształcenie, polityka (silna korelacja)
      traditionalism: normalInt(
        (age > 55 ? 65 : age < 35 ? 38 : 50)
        + { primary: 8, vocational: 4, secondary: 0, higher: -6 }[education]
        + (["pis", "td"].includes(affiliation) ? 10 : ["lewica", "ko"].includes(affiliation) ? -8 : 0),
        18, 0, 100
      ),
      // Collectivism: wyższe na wsi, wyższe wśród starszych (Hofstede PL = 60/100)
      collectivism: normalInt(
        50
        + { village: 6, small_city: 3, medium_city: 0, large_city: -2, metropolis: -5 }[settlementType]
        + (age > 55 ? 5 : age < 30 ? -3 : 0),
        18, 0, 100
      ),
      // Zaufanie do instytucji: silna korelacja z polityką i wiekiem
      institutionalTrust: normalInt(
        45
        + (["ko", "td"].includes(affiliation) ? 8 : ["pis"].includes(affiliation) ? -5 : ["konfederacja"].includes(affiliation) ? -15 : 0)
        + (age > 55 ? 5 : age < 30 ? -5 : 0),
        20, 0, 100
      ),
      mediaTrust: normalInt(
        40
        + (affiliation === "konfederacja" ? -15 : affiliation === "pis" ? -8 : affiliation === "ko" ? 5 : 0)
        + { village: 3, small_city: 2, medium_city: 0, large_city: -2, metropolis: -4 }[settlementType],
        20, 0, 100
      ),
      brandTrust: normalInt(50, 18, 0, 100),
    },
    consumer: {
      primaryCategories: sampleProductCategories(),
      brandLoyalty: normalInt(50, 20, 0, 100),
      shoppingChannels: weightedRandom([
        [["online"], 25],
        [["offline"], 35],
        [["mixed"], 40],
      ]),
      mediaHabits: sampleMediaHabits(age, settlementType),
      dailyMediaHours: normalInt(age > 50 ? 5 : 4, 2, 1, 10),
      responsiveTo: sampleCommunicationStyles(),
    },
    political: {
      affiliation,
      engagementLevel: normalInt(age > 35 ? 55 : 40, 22, 0, 100),
      euAttitude: normalInt(
        (settlementType === "metropolis" ? 65 : 50)
        + (education === "higher" ? 8 : 0)
        + (affiliation === "konfederacja" ? -15 : affiliation === "lewica" ? 10 : 0),
        22, 0, 100
      ),
      securityFocus: normalInt(age > 50 ? 65 : 50, 20, 0, 100),
      climateAwareness: normalInt(
        (age < 40 ? 60 : 45)
        + (education === "higher" ? 8 : 0)
        + (affiliation === "lewica" ? 12 : affiliation === "konfederacja" ? -10 : 0),
        22, 0, 100
      ),
      migrationAttitude: normalInt(
        (age > 50 ? 40 : 50)
        + (affiliation === "konfederacja" ? -15 : affiliation === "pis" ? -8 : affiliation === "lewica" ? 8 : 0),
        22, 0, 100
      ),
    },
  };
  persona.brandMemory = assignBrandMemory(persona);
  return persona;
}

export function generatePopulation(size: number = 50): Persona[] {
  return Array.from({ length: size }, generatePersona);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI: tsx src/personas/generator.ts [liczba]
// ─────────────────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("generator.ts") || process.argv[1]?.endsWith("generator.js")) {
  const { writeFileSync, mkdirSync } = await import("fs");
  const { join } = await import("path");

  const size = parseInt(process.argv[2] ?? "50", 10);
  const population = generatePopulation(size);

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  const outPath = join(process.cwd(), "data", "population.json");
  writeFileSync(outPath, JSON.stringify(population, null, 2), "utf8");

  console.log(`✓ Wygenerowano ${size} person → ${outPath}`);

  // Podgląd rozkładu
  const genders = population.reduce((acc, p) => {
    acc[p.demographic.gender] = (acc[p.demographic.gender] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const settlements = population.reduce((acc, p) => {
    acc[p.demographic.settlementType] = (acc[p.demographic.settlementType] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const politics = population.reduce((acc, p) => {
    acc[p.political.affiliation] = (acc[p.political.affiliation] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgAge = Math.round(population.reduce((s, p) => s + p.demographic.age, 0) / size);

  console.log("\n── Rozkład populacji ──────────────────────────");
  console.log(`Wiek średni: ${avgAge} lat`);
  console.log("Płeć:", genders);
  console.log("Typ miejscowości:", settlements);
  console.log("Preferencje polityczne:", politics);
}
