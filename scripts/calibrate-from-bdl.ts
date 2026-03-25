// ─────────────────────────────────────────────────────────────────────────────
// Kalibracja populacji z GUS Bank Danych Lokalnych (BDL API)
// Dokumentacja: https://bdl.stat.gov.pl/api/v1/
//
// Uruchomienie: tsx scripts/calibrate-from-bdl.ts
// Generuje:     data/calibration/bdl_snapshot.json
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const API = "https://bdl.stat.gov.pl/api/v1";
const HEADERS = { Accept: "application/json" };

async function get(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`BDL ${path} → ${res.status}`);
  return res.json();
}

// ─── Zmienne BDL (odkryte przez eksplorację API) ─────────────────────────────

const VARS = {
  // Dochody gospodarstw domowych (P1869) – dane roczne, 1999–2024
  income_disposable_per_capita:  216973,  // Dochód rozporządzalny na osobę (PLN)
  income_total_per_capita:       216968,  // Dochód ogółem na osobę (PLN)
  income_from_employment:        216969,  // Z pracy najemnej
  income_from_selfemployment:    216971,  // Z samozatrudnienia
  income_from_social_benefits:   216972,  // Ze świadczeń społecznych

  // Ludność wg płci (GUS roczne)
  population_total:              395505,  // NSP – ludność ogółem
};

// ─── Regiony – wagi dla województw ──────────────────────────────────────────
// unit-level=2 → województwa (NUTS 2)
const VOIVODESHIPS: Record<string, string> = {
  "2": "dolnoslaskie",
  "4": "kujawsko-pomorskie",
  "6": "lubelskie",
  "8": "lubuskie",
  "10": "lodzkie",
  "12": "malopolskie",
  "14": "mazowieckie",
  "16": "opolskie",
  "18": "podkarpackie",
  "20": "podlaskie",
  "22": "pomorskie",
  "24": "slaskie",
  "26": "swietokrzyskie",
  "28": "warminsko-mazurskie",
  "30": "wielkopolskie",
  "32": "zachodniopomorskie",
};

async function fetchTimeSeries(varId: number, unitLevel = 0): Promise<{ year: number; val: number }[]> {
  const data = await get(`/data/by-variable/${varId}?unit-level=${unitLevel}&lang=pl&page=0&pageSize=1`);
  const result = data.results?.[0];
  if (!result) return [];
  return (result.values as any[])
    .filter((v: any) => v.val !== null)
    .map((v: any) => ({ year: Number(v.year), val: Number(v.val) }))
    .sort((a: any, b: any) => a.year - b.year);
}

async function fetchRegionalLatest(varId: number): Promise<{ id: string; val: number }[]> {
  const data = await get(`/data/by-variable/${varId}?unit-level=2&lang=pl&page=0&pageSize=20`);
  return (data.results ?? []).map((r: any) => ({
    id: r.id,
    val: r.values?.at(-1)?.val ?? null,
  })).filter((r: any) => r.val !== null);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("◆ Pobieranie danych z GUS BDL API...\n");

  // 1. Dochody
  console.log("  → Dochód rozporządzalny per capita...");
  const incomeTs = await fetchTimeSeries(VARS.income_disposable_per_capita);
  const latestIncome = incomeTs.at(-1);
  const prevYearIncome = incomeTs.at(-2);

  console.log(`     ${latestIncome?.year}: ${latestIncome?.val} PLN (${prevYearIncome?.year}: ${prevYearIncome?.val} PLN)`);

  // 2. Źródła dochodów (najnowszy rok)
  console.log("  → Struktura źródeł dochodów...");
  const incomeEmployment = (await fetchTimeSeries(VARS.income_from_employment)).at(-1);
  const incomeSelf = (await fetchTimeSeries(VARS.income_from_selfemployment)).at(-1);
  const incomeSocial = (await fetchTimeSeries(VARS.income_from_social_benefits)).at(-1);

  // 3. Wagi regionalne (ludność wg województw – NSP)
  console.log("  → Wagi regionalne (województwa)...");
  let regionWeights: Record<string, number> = {};
  try {
    const regional = await fetchRegionalLatest(VARS.population_total);
    const totalPop = regional.reduce((s, r) => s + r.val, 0);
    for (const r of regional) {
      const name = VOIVODESHIPS[r.id] ?? r.id;
      regionWeights[name] = Math.round((r.val / totalPop) * 1000) / 10; // %
    }
  } catch (e) {
    console.log("     (pominięto – dane regionalne niedostępne)");
  }

  // ─── Sugerowane progi dochodowe ──────────────────────────────────────────
  // Dochód rozporządzalny per capita 2024 = 3 103 PLN
  // Dla gosp. domowego ~2.5 os → ~7 750 PLN
  // Nasze bracki są "per earner / per household" – nie per capita
  // Szacunek proporcjonalny: skala bracketów powinna rosnąć ~+12%/rok (inflacja+realny wzrost)
  const baseYear = 2023;
  const baseIncome = incomeTs.find(v => v.year === baseYear)?.val ?? 2622;
  const currentIncome = latestIncome?.val ?? 3103;
  const growthFactor = currentIncome / baseIncome;

  const BRACKETS_2023 = { below_2000: 2000, lower: 3500, middle: 5000, upper: 8000 };
  const suggestedBrackets = {
    below: Math.round(BRACKETS_2023.below_2000 * growthFactor / 100) * 100,
    lower: Math.round(BRACKETS_2023.lower * growthFactor / 100) * 100,
    middle: Math.round(BRACKETS_2023.middle * growthFactor / 100) * 100,
    upper: Math.round(BRACKETS_2023.upper * growthFactor / 100) * 100,
  };

  // ─── Output ──────────────────────────────────────────────────────────────
  const snapshot = {
    _meta: {
      source: "GUS Bank Danych Lokalnych (BDL API)",
      url: "https://bdl.stat.gov.pl/api/v1/",
      generated: new Date().toISOString(),
      note: "Dane dochodowe aktualne (2024). Dane demograficzne (wiek, wykształcenie) pochodzi z BAEL Q2 2025 – nowsze niż NSP 2011 dostępne w BDL.",
    },
    income: {
      disposable_per_capita_pln: {
        latest_year: latestIncome?.year,
        latest_value: latestIncome?.val,
        timeseries: incomeTs.slice(-5),
        yoy_growth_pct: Math.round((growthFactor - 1) * 1000) / 10,
      },
      structure_pct: {
        from_employment: incomeEmployment ? Math.round(incomeEmployment.val / (latestIncome?.val ?? 1) * 100) : null,
        from_selfemployment: incomeSelf ? Math.round(incomeSelf.val / (latestIncome?.val ?? 1) * 100) : null,
        from_social_benefits: incomeSocial ? Math.round(incomeSocial.val / (latestIncome?.val ?? 1) * 100) : null,
      },
    },
    suggested_income_brackets: {
      note: `Progi przeskalowane z 2023 wg wzrostu dochodu rozporządzalnego (×${growthFactor.toFixed(3)})`,
      below_2000_threshold: suggestedBrackets.below,
      lower_threshold: suggestedBrackets.lower,
      middle_threshold: suggestedBrackets.middle,
      upper_threshold: suggestedBrackets.upper,
    },
    region_weights_pct: Object.keys(regionWeights).length > 0 ? regionWeights : "niedostępne",
  };

  const outDir = join(process.cwd(), "data", "calibration");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "bdl_snapshot.json");
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");

  console.log(`\n✓ Snapshot zapisany → ${outPath}`);
  console.log("\n── Kluczowe dane ──────────────────────────────────────");
  console.log(`  Dochód rozporządzalny per capita (${latestIncome?.year}): ${latestIncome?.val} PLN`);
  console.log(`  Wzrost r/r: +${snapshot.income.disposable_per_capita_pln.yoy_growth_pct}%`);
  console.log(`\n  Sugerowane nowe progi bracketów dochodowych:`);
  console.log(`    below_low:    < ${suggestedBrackets.below} PLN   (było < 2 000)`);
  console.log(`    low→middle:   < ${suggestedBrackets.lower} PLN   (było < 3 500)`);
  console.log(`    middle→upper: < ${suggestedBrackets.middle} PLN  (było < 5 000)`);
  console.log(`    upper→high:   < ${suggestedBrackets.upper} PLN   (było < 8 000)`);
  console.log(`\n  ⚠ Progi w distributions.ts i schema.ts wymagają ręcznej aktualizacji.`);
  console.log(`    Uruchom ponownie po weryfikacji danych.`);
}

main().catch(console.error);
