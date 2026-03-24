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

// Wiek: populacja 18–80 lat
// Źródło: GUS Rocznik Demograficzny 2023 – ludność wg wieku (dane za 2022 r.)
// Udziały grupy wiekowej w populacji 18–80+: przeliczone na wagi.
export function sampleAge(): number {
  // Losujemy grupę wiekową wg rzeczywistych udziałów GUS
  const group = weightedRandom<[number, number]>([
    [[18, 24], 85],   // 8.5%
    [[25, 34], 138],  // 13.8%
    [[35, 44], 165],  // 16.5%
    [[45, 54], 141],  // 14.1%
    [[55, 64], 154],  // 15.4%
    [[65, 74], 128],  // 12.8%
    [[75, 80], 45],   // 4.5%  (przycięte do 80)
  ]);
  // Jednostajny losowy wiek w obrębie grupy
  return group[0] + Math.floor(Math.random() * (group[1] - group[0] + 1));
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
// Źródło: CBOS Komunikat BS/9/2025 „Preferencje partyjne w styczniu 2025"
// Udziały wśród wszystkich dorosłych (w tym niezdecydowanych i niedeklarujących)
// PiS 28%, KO 27%, TD 9%, Lewica 7%, Konfederacja 11%,
// niezdecydowani 11%, apolityczni 7% (łącznie ~100%)
// ─────────────────────────────────────────────────────────────────────────────

export function samplePoliticalAffiliation(age: number, settlementType: SettlementType): PoliticalAffiliation {
  const base: [PoliticalAffiliation, number][] = [
    ["pis",          28],
    ["ko",           27],
    ["td",            9],
    ["lewica",        7],
    ["konfederacja", 11],
    ["undecided",    11],
    ["apolitical",    7],
  ];

  const adjusted: [PoliticalAffiliation, number][] = base.map(([party, w]) => {
    let weight = w;
    // PiS: silniejszy wśród 55+ i mieszkańców wsi (CBOS segmentacja 2024)
    if (party === "pis") {
      if (age > 55) weight += 8;
      if (settlementType === "village") weight += 6;
    }
    // KO: silniejszy w metropoliach i wśród wyborców 30–55
    if (party === "ko") {
      if (settlementType === "metropolis") weight += 8;
      if (settlementType === "large_city") weight += 4;
      if (age >= 30 && age <= 55) weight += 3;
    }
    // Konfederacja: silna wśród mężczyzn 18–35
    if (party === "konfederacja") {
      if (age < 35) weight += 6;
      if (age < 28) weight += 4;
    }
    // Lewica: urbańska, młodsi wyborcy
    if (party === "lewica") {
      if (age < 40) weight += 3;
      if (settlementType === "metropolis" || settlementType === "large_city") weight += 4;
    }
    // TD: wieś i małe miasta (PSL-baza)
    if (party === "td") {
      if (settlementType === "village" || settlementType === "small_city") weight += 4;
    }
    return [party, Math.max(1, weight)];
  });

  return weightedRandom(adjusted);
}

// ─────────────────────────────────────────────────────────────────────────────
// Media habits
// Źródło: Gemius/PBI Megapanel 2024 Q3 – zasięg tygodniowy wśród dorosłych
// TV: Kantar Media 2024 (% oglądalności tygodniowej)
// Wartości = % populacji korzystających regularnie (p * 100)
// ─────────────────────────────────────────────────────────────────────────────

export function sampleMediaHabits(age: number, settlementType: SettlementType): MediaPlatform[] {
  // Zasięg tygodniowy (%) – dane Gemius/PBI/Kantar 2024, segmentowane wg wieku
  const platforms: [MediaPlatform, number][] = [
    // TV publiczna (TVP): wysoki zasięg 55+, mocny na wsi; Kantar: 63% tygodniowo ogółem
    ["tv_public",   age > 65 ? 72 : age > 50 ? 58 : age > 35 ? 38 : 22],
    // TV prywatna (TVN/Polsat): 70% ogółem, silna 35–65
    ["tv_private",  age > 65 ? 65 : age > 40 ? 68 : age > 25 ? 55 : 38],
    // Facebook: Gemius 2024 – 73% dorosłych internautów, dominuje 30–55
    ["facebook",    age > 65 ? 40 : age > 45 ? 68 : age > 25 ? 78 : 62],
    // Instagram: silna 18–34 (68%), spada po 45
    ["instagram",   age < 25 ? 72 : age < 35 ? 65 : age < 45 ? 48 : age < 55 ? 28 : 12],
    // TikTok: silny 18–24 (74%), spada gwałtownie po 35
    ["tiktok",      age < 20 ? 78 : age < 25 ? 72 : age < 30 ? 55 : age < 40 ? 32 : age < 50 ? 15 : 6],
    // YouTube: najszerszy zasięg 18–44 (80%), utrzymuje się do 60+
    ["youtube",     age < 35 ? 82 : age < 50 ? 75 : age < 65 ? 52 : 30],
    // X/Twitter: niszowy w PL (~14% aktywnych internautów)
    ["x_twitter",   age < 35 ? 18 : age < 50 ? 14 : 8],
    // LinkedIn: profesjonalne, głównie 25–50 w miastach
    ["linkedin",    (age > 25 && age < 55 && settlementType !== "village") ? 32 : 8],
    // Prasa drukowana: mocno spada; Kantar: 22% tygodniowo ogółem, głównie 50+
    ["print_press", age > 65 ? 38 : age > 50 ? 28 : age > 35 ? 14 : 6],
    // Serwisy informacyjne online: bardzo wysoki zasięg (85% internautów)
    ["online_news", age > 65 ? 52 : age > 50 ? 68 : 82],
    // Podcasty: rosnące, głównie 25–45, wyższe wykształcenie i miasta
    ["podcast",     age < 25 ? 28 : age < 40 ? 38 : age < 55 ? 25 : 10],
    // Radio: Kantar 2024 – 62% tygodniowo; głównie 35+ (w samochodzie)
    ["radio",       age > 55 ? 55 : age > 35 ? 62 : age > 25 ? 48 : 32],
  ];

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
