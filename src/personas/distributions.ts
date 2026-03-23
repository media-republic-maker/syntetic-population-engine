// ─────────────────────────────────────────────────────────────────────────────
// Rozkłady demograficzne polskiej populacji
// Źródła: GUS BAEL 2023, CBOS 2023, Eurostat, Gemius/PBI
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Gender,
  SettlementType,
  Region,
  EducationLevel,
  HouseholdType,
  IncomeLevel,
  PoliticalAffiliation,
  MediaPlatform,
  CommunicationStyle,
  ProductCategory,
} from "./schema.js";

// Losuje element z tablicy ważonej [wartość, waga]
export function weightedRandom<T>(items: [T, number][]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * total;
  for (const [item, weight] of items) {
    rand -= weight;
    if (rand <= 0) return item;
  }
  return items[items.length - 1][0];
}

// Losuje liczbę całkowitą z rozkładu normalnego (Box-Muller)
export function normalInt(mean: number, std: number, min: number, max: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(max, Math.max(min, Math.round(mean + z * std)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Demograficzne
// ─────────────────────────────────────────────────────────────────────────────

// Wiek: populacja 18–80 lat, rozkład GUS 2023
export function sampleAge(): number {
  return weightedRandom<number>([
    [20, 8],   // 18–24
    [27, 9],   // 25–29
    [32, 10],  // 30–34
    [37, 10],  // 35–39
    [42, 10],  // 40–44
    [47, 9],   // 45–49
    [52, 9],   // 50–54
    [57, 9],   // 55–59
    [63, 11],  // 60–65
    [70, 8],   // 66–74
    [77, 7],   // 75–80
  ]) + Math.floor(Math.random() * 5) - 2; // ±2 lata wariancji
}

export function sampleGender(): Gender {
  return weightedRandom<Gender>([
    ["male", 48],
    ["female", 52],
  ]);
}

export function sampleEducation(): EducationLevel {
  return weightedRandom<EducationLevel>([
    ["primary", 5],
    ["vocational", 25],
    ["secondary", 36],
    ["higher", 34],
  ]);
}

export function sampleSettlementType(): SettlementType {
  return weightedRandom<SettlementType>([
    ["village", 40],
    ["small_city", 18],
    ["medium_city", 20],
    ["large_city", 10],
    ["metropolis", 12],
  ]);
}

export function sampleRegion(): Region {
  return weightedRandom<Region>([
    ["mazowieckie", 14],
    ["slaskie", 12],
    ["wielkopolskie", 9],
    ["malopolskie", 9],
    ["dolnoslaskie", 7],
    ["lodzkie", 6],
    ["pomorskie", 6],
    ["kujawsko-pomorskie", 5],
    ["lubelskie", 5],
    ["podkarpackie", 5],
    ["warminsko-mazurskie", 4],
    ["zachodniopomorskie", 4],
    ["swietokrzyskie", 3],
    ["podlaskie", 3],
    ["lubuskie", 2],
    ["opolskie", 2],
                                   // razem ~100%
  ]);
}

export function sampleHousehold(age: number, gender: Gender): HouseholdType {
  if (age < 28) {
    return weightedRandom<HouseholdType>([
      ["single", 50],
      ["couple_no_kids", 25],
      ["family_young_kids", 10],
      ["family_adult_kids", 15],
    ]);
  }
  if (age < 45) {
    return weightedRandom<HouseholdType>([
      ["single", 15],
      ["couple_no_kids", 20],
      ["family_young_kids", 35],
      ["family_teen_kids", 15],
      ["single_parent", 10],
      ["multigenerational", 5],
    ]);
  }
  if (age < 60) {
    return weightedRandom<HouseholdType>([
      ["couple_no_kids", 25],
      ["family_teen_kids", 20],
      ["family_adult_kids", 30],
      ["multigenerational", 10],
      ["single", 15],
    ]);
  }
  return weightedRandom<HouseholdType>([
    ["couple_no_kids", 35],
    ["single", 30],
    ["multigenerational", 20],
    ["family_adult_kids", 15],
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Finansowe
// ─────────────────────────────────────────────────────────────────────────────

export function sampleIncomeLevel(education: EducationLevel, settlementType: SettlementType): IncomeLevel {
  // Bazowy rozkład (GUS budżety gosp. domowych 2023)
  const base: [IncomeLevel, number][] = [
    ["below_2000", 12],
    ["2000_3500", 30],
    ["3500_5000", 28],
    ["5000_8000", 20],
    ["above_8000", 10],
  ];

  // Korekty edukacyjne
  const eduBoost = { primary: -2, vocational: -1, secondary: 0, higher: 2 }[education];
  // Korekty geograficzne
  const geoBoost = { village: -1, small_city: -1, medium_city: 0, large_city: 1, metropolis: 2 }[settlementType];

  // Przesuń wagi proporcjonalnie
  const adjusted = base.map(([level, w], i): [IncomeLevel, number] => {
    const shift = (i - 2) * (eduBoost + geoBoost) * 0.5;
    return [level, Math.max(1, w + shift)];
  });

  return weightedRandom(adjusted);
}

export function sampleOwnsProperty(age: number, incomeLevel: IncomeLevel): boolean {
  const incomeScore = { below_2000: 0, "2000_3500": 1, "3500_5000": 2, "5000_8000": 3, above_8000: 4 }[incomeLevel];
  const ageScore = age > 35 ? 2 : age > 28 ? 1 : 0;
  const probability = Math.min(0.85, 0.2 + (incomeScore + ageScore) * 0.1);
  return Math.random() < probability;
}

// ─────────────────────────────────────────────────────────────────────────────
// Polityczne
// Rozkład: CBOS preferencje partyjne 2024 (wśród deklarujących)
// ─────────────────────────────────────────────────────────────────────────────

export function samplePoliticalAffiliation(age: number, settlementType: SettlementType): PoliticalAffiliation {
  // Bazowy rozkład wśród ogółu dorosłych Polaków
  const base: [PoliticalAffiliation, number][] = [
    ["pis", 28],
    ["ko", 27],
    ["td", 10],
    ["lewica", 8],
    ["konfederacja", 12],
    ["undecided", 10],
    ["apolitical", 5],
  ];

  // Korekta wiekowa: PiS silniejszy 55+, Konfederacja silniejsza 18–35
  const youngBoost = age < 35 ? 3 : 0;
  const oldBoost = age > 55 ? 3 : 0;

  // Korekta geograficzna: wieś → PiS, metropolia → KO
  const ruralBoost = settlementType === "village" ? 5 : 0;
  const urbanBoost = settlementType === "metropolis" ? 5 : 0;

  const adjusted: [PoliticalAffiliation, number][] = base.map(([party, w]) => {
    let weight = w;
    if (party === "pis") weight += oldBoost + ruralBoost;
    if (party === "ko") weight += urbanBoost;
    if (party === "konfederacja") weight += youngBoost;
    if (party === "lewica") weight += (age < 40 ? 2 : 0) + (urbanBoost > 0 ? 2 : 0);
    return [party, Math.max(1, weight)];
  });

  return weightedRandom(adjusted);
}

// ─────────────────────────────────────────────────────────────────────────────
// Media habits
// Źródła: Gemius/PBI, Kantar Media 2023
// ─────────────────────────────────────────────────────────────────────────────

export function sampleMediaHabits(age: number, settlementType: SettlementType): MediaPlatform[] {
  const platforms: [MediaPlatform, number][] = [
    ["tv_public", age > 55 ? 70 : 30],
    ["tv_private", age > 40 ? 60 : 35],
    ["facebook", age > 25 ? 65 : 40],
    ["instagram", age < 40 ? 60 : 25],
    ["tiktok", age < 30 ? 65 : age < 45 ? 30 : 10],
    ["youtube", age < 50 ? 55 : 30],
    ["x_twitter", 15],
    ["linkedin", age > 25 && age < 55 ? 30 : 10],
    ["print_press", age > 50 ? 35 : 10],
    ["online_news", 50],
    ["podcast", age > 20 && age < 50 ? 30 : 10],
    ["radio", age > 35 ? 40 : 20],
  ];

  // Każda platforma jest wybierana niezależnie, proporcjonalnie do wagi
  return platforms
    .filter(([, w]) => Math.random() * 100 < w)
    .map(([p]) => p);
}

export function sampleCommunicationStyles(): CommunicationStyle[] {
  const all: CommunicationStyle[] = [
    "emotional", "rational", "humorous", "authority",
    "social_proof", "aspirational", "fear_of_missing",
  ];
  // 2–4 style per persona
  const count = 2 + Math.floor(Math.random() * 3);
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function sampleProductCategories(): ProductCategory[] {
  const all: [ProductCategory, number][] = [
    ["fmcg", 90],
    ["electronics", 55],
    ["fashion", 50],
    ["financial_services", 45],
    ["food_delivery", 40],
    ["entertainment", 60],
    ["travel", 35],
    ["healthcare", 40],
    ["home_appliances", 45],
    ["automotive", 30],
  ];
  return all.filter(([, w]) => Math.random() * 100 < w).map(([c]) => c);
}

// ─────────────────────────────────────────────────────────────────────────────
// Imiona (fikcyjne, do czytelności logów)
// ─────────────────────────────────────────────────────────────────────────────

const MALE_NAMES = [
  "Adam", "Andrzej", "Bartosz", "Damian", "Grzegorz", "Jakub", "Jan",
  "Kamil", "Krzysztof", "Łukasz", "Marcin", "Marek", "Michał", "Paweł",
  "Piotr", "Rafał", "Robert", "Sławomir", "Stanisław", "Tomasz", "Wojciech",
];

const FEMALE_NAMES = [
  "Agnieszka", "Aleksandra", "Anna", "Barbara", "Beata", "Dorota", "Ewa",
  "Joanna", "Justyna", "Katarzyna", "Karolina", "Magdalena", "Małgorzata",
  "Maria", "Marta", "Monika", "Natalia", "Paulina", "Sylwia", "Zofia",
];

export function sampleName(gender: Gender): string {
  const pool = gender === "male" ? MALE_NAMES : FEMALE_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
