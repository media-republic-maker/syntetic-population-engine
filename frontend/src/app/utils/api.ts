// ─────────────────────────────────────────────────────────────────────────────
// API client — łączy się z backendem na /api/*
// Proxy Vite → http://localhost:3000 (vite.config.ts)
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "";

// ─── Typy (zgodne z mockApi.ts – nie zmieniamy UI) ───────────────────────────

export interface PopulationStats {
  total: number;
  averageAge: number;
  genderDistribution: { male: number; female: number };
  regions: { urban: number; suburban: number; rural: number };
  incomeDistribution: { low: number; medium: number; high: number };
  education: { basic: number; secondary: number; higher: number };
  politicalPreferences: { left: number; center: number; right: number };
}

export interface Campaign {
  id: string;
  name: string;
  brand: string;
  date: string;
  attentionScore: number;
  resonance: number;
  purchaseIntentDelta: number;
  trustDelta: number;
}

export interface StudyResult {
  id: string;
  campaignName: string;
  date: string;
  metrics: {
    attention: number;
    resonance: number;
    purchaseIntentDelta: number;
    trustDelta: number;
  };
  segmentData: {
    age: Array<{ segment: string; attention: number; resonance: number; purchaseIntent: number }>;
    gender: Array<{ segment: string; attention: number; resonance: number; purchaseIntent: number }>;
    location: Array<{ segment: string; attention: number; resonance: number; purchaseIntent: number }>;
  };
  topRecall: string[];
  womQuotes: string[];
  rejectionSignals: string[];
  socialSpread?: {
    viralScore: number;
    chains: Array<{ depth: number; reach: number; engagement: number }>;
  };
  // Surowe dane z backendu (do PDF export / spread)
  _raw?: {
    reportA: any;
    reportB?: any;
    adA: any;
    responsesA: any[];
    population: any[];
    filterDesc?: string;
  };
}

// ─── Mapowania ────────────────────────────────────────────────────────────────

function pct(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function mapPopulation(raw: any): PopulationStats {
  const total = raw.total as number;

  const male = raw.gender?.male ?? 0;
  const female = raw.gender?.female ?? 0;
  const gTotal = male + female || 1;

  const village = raw.settlement?.village ?? 0;
  const smallCity = raw.settlement?.small_city ?? 0;
  const mediumCity = raw.settlement?.medium_city ?? 0;
  const largeCity = raw.settlement?.large_city ?? 0;
  const metropolis = raw.settlement?.metropolis ?? 0;

  const below2k = raw.incomeLevel?.below_2000 ?? 0;
  const inc2k3k = raw.incomeLevel?.["2000_3500"] ?? 0;
  const inc3k5k = raw.incomeLevel?.["3500_5000"] ?? 0;
  const inc5k8k = raw.incomeLevel?.["5000_8000"] ?? 0;
  const above8k = raw.incomeLevel?.above_8000 ?? 0;

  const primary = raw.education?.primary ?? 0;
  const vocational = raw.education?.vocational ?? 0;
  const secondary = raw.education?.secondary ?? 0;
  const higher = raw.education?.higher ?? 0;

  const pis = raw.political?.pis ?? 0;
  const konfederacja = raw.political?.konfederacja ?? 0;
  const ko = raw.political?.ko ?? 0;
  const lewica = raw.political?.lewica ?? 0;
  const td = raw.political?.td ?? 0;
  const undecided = raw.political?.undecided ?? 0;

  return {
    total,
    averageAge: raw.avgAge ?? 0,
    genderDistribution: {
      male: pct(male, gTotal),
      female: pct(female, gTotal),
    },
    regions: {
      urban: pct(largeCity + metropolis, total),
      suburban: pct(mediumCity + smallCity, total),
      rural: pct(village, total),
    },
    incomeDistribution: {
      low: pct(below2k + inc2k3k, total),
      medium: pct(inc3k5k, total),
      high: pct(inc5k8k + above8k, total),
    },
    education: {
      basic: pct(primary + vocational, total),
      secondary: pct(secondary, total),
      higher: pct(higher, total),
    },
    politicalPreferences: {
      left: pct(ko + lewica, total),
      center: pct(td + undecided, total),
      right: pct(pis + konfederacja, total),
    },
  };
}

const SETTLEMENT_LABELS: Record<string, string> = {
  village: "Wieś",
  small_city: "Małe miasto",
  medium_city: "Miasto średnie",
  large_city: "Duże miasto",
  metropolis: "Metropolia",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Mężczyźni",
  female: "Kobiety",
};

function mapSegment(segs: Record<string, any>, labels: Record<string, string>) {
  return Object.entries(segs).map(([key, s]) => ({
    segment: labels[key] ?? s.label ?? key,
    attention: s.attentionScore ?? 0,
    resonance: s.resonanceScore ?? 0,
    purchaseIntent: s.purchaseIntentDelta ?? 0,
  }));
}

function mapReportToStudyResult(raw: {
  reportA: any;
  reportB?: any;
  adA: any;
  responsesA: any[];
  population: any[];
  filterDesc?: string;
  file?: string;
  ts?: string;
}): StudyResult {
  const { reportA, adA } = raw;
  const agg = reportA?.aggregate ?? {};

  const womQuotes = (reportA?.topWom ?? []).slice(0, 4).map((q: string) =>
    q.startsWith('"') ? q : `"${q}"`
  );

  // Parsuj ts z formatu "2026-03-23T13-27-13-302Z"
  const rawTs = raw.ts ?? raw.file ?? "";
  const isoTs = rawTs.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d+)Z/, "T$1:$2:$3.$4Z");
  const date = isoTs ? new Date(isoTs).toISOString() : new Date().toISOString();

  return {
    id: raw.file ?? `study-${Date.now()}`,
    campaignName: adA?.brandName
      ? `${adA.brandName} – ${adA.headline?.slice(0, 30) ?? "badanie"}`
      : adA?.headline?.slice(0, 40) ?? "Nowe badanie",
    date,
    metrics: {
      attention: agg.attentionScore ?? 0,
      resonance: agg.resonanceScore ?? 0,
      purchaseIntentDelta: agg.purchaseIntentDelta ?? 0,
      trustDelta: agg.trustImpact ?? 0,
    },
    segmentData: {
      age: mapSegment(reportA?.byAgeGroup ?? {}, {}),
      gender: mapSegment(reportA?.byGender ?? {}, GENDER_LABELS),
      location: mapSegment(reportA?.bySettlement ?? {}, SETTLEMENT_LABELS),
    },
    topRecall: reportA?.topRecalls ?? [],
    womQuotes,
    rejectionSignals: reportA?.allRejections ?? [],
    _raw: raw,
  };
}

// ─── Funkcje API ──────────────────────────────────────────────────────────────

export async function getPopulation(): Promise<PopulationStats> {
  const res = await fetch(`${BASE}/api/population`);
  if (!res.ok) throw new Error("Błąd pobierania populacji");
  return mapPopulation(await res.json());
}

export async function getCampaigns(): Promise<Campaign[]> {
  const res = await fetch(`${BASE}/api/results`);
  if (!res.ok) return [];
  const results: any[] = await res.json();
  return results.map((r) => {
    const agg = r.reportA?.aggregate ?? {};
    const rawTs = r.ts ?? "";
    const isoTs = rawTs.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d+)Z/, "T$1:$2:$3.$4Z");
    return {
      id: r.file ?? r.ts,
      name: r.adA?.brandName
        ? `${r.adA.brandName} – ${(r.adA.headline ?? "").slice(0, 30)}`
        : (r.adA?.headline ?? "Badanie").slice(0, 40),
      brand: r.adA?.brandName ?? "–",
      date: isoTs ? new Date(isoTs).toISOString() : new Date().toISOString(),
      attentionScore: agg.attentionScore ?? 0,
      resonance: agg.resonanceScore ?? 0,
      purchaseIntentDelta: agg.purchaseIntentDelta ?? 0,
      trustDelta: agg.trustImpact ?? 0,
    };
  });
}

export async function getBrands(): Promise<string[]> {
  const res = await fetch(`${BASE}/api/brands`);
  if (!res.ok) return [];
  const brands: any[] = await res.json();
  return brands.map((b) => b.brandName);
}

export const mockCategories = [
  "FMCG",
  "Elektronika",
  "Moda",
  "Usługi finansowe",
  "Motoryzacja",
  "Dostawa jedzenia",
  "Podróże",
  "Zdrowie",
  "Rozrywka",
  "AGD/RTV",
  "Uroda / Pielęgnacja",
];

export const mockContexts = [
  "Facebook Feed",
  "Instagram Stories",
  "YouTube Pre-roll",
  "TikTok In-Feed",
  "Desktop Display",
  "Mobile Banner",
  "LinkedIn Sponsored",
  "Pre-roll radio online",
];

// ─── Uruchamianie badania przez SSE ──────────────────────────────────────────

export interface StudyFormData {
  headline: string;
  body: string;
  cta: string;
  brand?: string;
  category?: string;
  context?: string;
  abMode?: boolean;
  headlineB?: string;
  bodyB?: string;
  ctaB?: string;
  brandB?: string;
  socialSpread?: boolean;
  filterGender?: string;
  filterAgeMin?: string;
  filterAgeMax?: string;
  filterSettlement?: string;
  filterIncome?: string;
}

export async function runStudy(
  formData: StudyFormData,
  onProgress: (progress: number, label: string) => void,
  onComplete: (result: StudyResult) => void,
  onError: (msg: string) => void,
): Promise<() => void> {
  const params = new URLSearchParams({
    headline: formData.headline,
    body: formData.body,
    cta: formData.cta,
    brandName: formData.brand ?? "",
    productCategory: formData.category ?? "",
    context: formData.context ?? "",
    ab: formData.abMode ? "1" : "0",
    headlineB: formData.headlineB ?? "",
    bodyB: formData.bodyB ?? "",
    ctaB: formData.ctaB ?? "",
    brandNameB: formData.brandB ?? "",
    filterGender: formData.filterGender ?? "all",
    filterAgeMin: formData.filterAgeMin ?? "0",
    filterAgeMax: formData.filterAgeMax ?? "99",
    filterSettlement: formData.filterSettlement ?? "all",
    filterIncome: formData.filterIncome ?? "all",
  });

  const es = new EventSource(`${BASE}/api/study?${params}`);

  es.addEventListener("progress", (e) => {
    const { done, total, phase } = JSON.parse(e.data);
    const pct = (done / total) * 100;
    const adjustedPct = formData.abMode
      ? pct / 2 + (phase === "B" ? 50 : 0)
      : pct;
    const label = phase
      ? `Wariant ${phase}: ${done}/${total} botów`
      : `${done}/${total} botów`;
    onProgress(adjustedPct, label);
  });

  es.addEventListener("result", (e) => {
    es.close();
    const raw = JSON.parse(e.data);
    const result = mapReportToStudyResult(raw);
    sessionStorage.setItem("currentStudy", JSON.stringify(result));
    onComplete(result);
  });

  es.addEventListener("error", (e: any) => {
    es.close();
    const msg = e.data ? JSON.parse(e.data).message : "Sprawdź terminal serwera";
    onError(msg);
  });

  return () => es.close();
}

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportPDF(result: StudyResult): Promise<void> {
  if (!result._raw) throw new Error("Brak danych do eksportu");
  const res = await fetch(`${BASE}/api/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result._raw),
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "raport-sandbox.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Social Spread ────────────────────────────────────────────────────────────

export async function runSpread(result: StudyResult): Promise<any> {
  if (!result._raw) throw new Error("Brak danych do spread simulation");
  const res = await fetch(`${BASE}/api/spread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      responsesA: result._raw.responsesA,
      population: result._raw.population,
    }),
  });
  if (!res.ok) throw new Error("Błąd spread simulation");
  return res.json();
}
