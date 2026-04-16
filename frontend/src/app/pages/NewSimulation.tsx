import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Network, Loader2, ImagePlus, X, Filter, FlaskConical } from 'lucide-react';
import { startSimulation, uploadCreative, getBrands, mockCategories, type SimulationFormData } from '../utils/api';

// ─── Stałe ────────────────────────────────────────────────────────────────────

const CATEGORIES = mockCategories.map((c) => ({ value: c, label: c }));

const SETTLEMENTS = [
  { value: 'all',         label: 'Wszystkie' },
  { value: 'village',     label: 'Wieś' },
  { value: 'small_city',  label: 'Małe miasto' },
  { value: 'medium_city', label: 'Miasto średnie' },
  { value: 'large_city',  label: 'Duże miasto' },
  { value: 'metropolis',  label: 'Metropolia' },
];

const INCOMES = [
  { value: 'all',        label: 'Wszystkie' },
  { value: 'below_2000', label: 'Poniżej 2 000 zł' },
  { value: '2000_3500',  label: '2 000–3 500 zł' },
  { value: '3500_5000',  label: '3 500–5 000 zł' },
  { value: '5000_8000',  label: '5 000–8 000 zł' },
  { value: 'above_8000', label: 'Powyżej 8 000 zł' },
];

// ─── Typy ──────────────────────────────────────────────────────────────────────

interface CreativeState {
  file: File | null;
  preview: string | null;
  id: string | null;
  uploading: boolean;
  error: string | null;
}

const emptyCreative = (): CreativeState => ({
  file: null, preview: null, id: null, uploading: false, error: null,
});

interface AdForm {
  studyName: string;
  headline: string;
  body: string;
  cta: string;
  brand: string;
  category: string;
  context: string;
}

const emptyAd = (): AdForm => ({
  studyName: '', headline: '', body: '', cta: '', brand: '', category: '', context: '',
});

// ─── CreativeUploader ─────────────────────────────────────────────────────────

function CreativeUploader({
  state,
  onChange,
  label = 'Kreacja graficzna',
}: {
  state: CreativeState;
  onChange: (s: CreativeState) => void;
  label?: string;
}) {
  const handleSelect = async (file: File) => {
    onChange({ ...emptyCreative(), file, preview: URL.createObjectURL(file), uploading: true });
    try {
      const id = await uploadCreative(file);
      onChange((prev: CreativeState) => ({ ...prev, id, uploading: false }));
    } catch (err: any) {
      onChange((prev: CreativeState) => ({ ...prev, error: err.message ?? 'Błąd uploadu', uploading: false }));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ImagePlus className="w-4 h-4 text-[#6366f1]" />
        <span className="text-xs font-semibold text-white">{label}</span>
        <span className="text-xs text-[#52525b]">(opcjonalnie – JPG, PNG, WEBP)</span>
      </div>

      {!state.file ? (
        <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#27272a] rounded-lg cursor-pointer hover:border-[#6366f1] transition-colors">
          <ImagePlus className="w-4 h-4 text-[#52525b] mb-1" />
          <span className="text-xs text-[#52525b]">Kliknij lub przeciągnij plik</span>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSelect(f); }}
          />
        </label>
      ) : (
        <div className="flex items-start gap-3 bg-[#09090b] border border-[#27272a] rounded-lg p-3">
          {state.preview && (
            <img src={state.preview} alt="podgląd" className="h-14 rounded object-contain" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white truncate">{state.file.name}</span>
              <button type="button" onClick={() => onChange(emptyCreative())} className="text-[#52525b] hover:text-white flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
            {state.uploading && (
              <div className="flex items-center gap-1 mt-1">
                <Loader2 className="w-3 h-3 text-[#6366f1] animate-spin" />
                <span className="text-xs text-[#a1a1aa]">Przesyłanie...</span>
              </div>
            )}
            {state.id && !state.uploading && <span className="text-xs text-green-400 mt-1 block">✓ Gotowe</span>}
            {state.error && <span className="text-xs text-red-400 mt-1 block">{state.error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BrandAutocomplete ────────────────────────────────────────────────────────

function BrandAutocomplete({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = value.trim() ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase())).slice(0, 8) : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="np. T-Mobile"
        autoComplete="off"
        className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-[#18181b] border border-[#27272a] rounded-lg shadow-lg overflow-hidden">
          {filtered.map((b) => (
            <li
              key={b}
              onMouseDown={(e) => { e.preventDefault(); onChange(b); setOpen(false); }}
              className="px-3 py-2 text-sm text-white cursor-pointer hover:bg-[#27272a]"
            >
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── AdFields ────────────────────────────────────────────────────────────────

function AdFields({
  data,
  onChange,
  brands,
  creative,
  onCreativeChange,
  showName = false,
}: {
  data: AdForm;
  onChange: (d: AdForm) => void;
  brands: string[];
  creative: CreativeState;
  onCreativeChange: (s: CreativeState) => void;
  showName?: boolean;
}) {
  const set = (f: keyof AdForm, v: string) => onChange({ ...data, [f]: v });

  return (
    <div className="space-y-3">
      {showName && (
        <div>
          <label className="block text-xs text-[#a1a1aa] mb-1">Nazwa badania</label>
          <input
            type="text"
            value={data.studyName}
            onChange={(e) => set('studyName', e.target.value)}
            placeholder="np. Kampania T-Mobile Q2 2026"
            className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]"
          />
        </div>
      )}

      <CreativeUploader state={creative} onChange={onCreativeChange} />

      <div>
        <label className="block text-xs text-[#a1a1aa] mb-1">
          Headline
          {creative.id && !data.headline && (
            <span className="text-[#52525b] ml-1">(opcjonalnie — oceniasz sam KV)</span>
          )}
        </label>
        <input
          type="text"
          value={data.headline}
          onChange={(e) => set('headline', e.target.value)}
          placeholder={creative.id ? 'Opcjonalnie przy teście KV...' : 'Główny nagłówek reklamy'}
          className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]"
        />
      </div>

      <div>
        <label className="block text-xs text-[#a1a1aa] mb-1">Body <span className="text-[#52525b] font-normal">(opcjonalnie)</span></label>
        <textarea
          value={data.body}
          onChange={(e) => set('body', e.target.value)}
          placeholder="Treść reklamy"
          rows={3}
          className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1] resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-[#a1a1aa] mb-1">CTA <span className="text-[#52525b] font-normal">(opcjonalnie)</span></label>
        <input
          type="text"
          value={data.cta}
          onChange={(e) => set('cta', e.target.value)}
          placeholder="Call to action"
          className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#a1a1aa] mb-1">Marka</label>
          <BrandAutocomplete value={data.brand} onChange={(v) => set('brand', v)} options={brands} />
        </div>
        <div>
          <label className="block text-xs text-[#a1a1aa] mb-1">Kategoria</label>
          <select
            value={data.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]"
          >
            <option value="">– dowolna –</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#a1a1aa] mb-1">Kontekst emisji kreacji</label>
        <input
          type="text"
          value={data.context}
          onChange={(e) => set('context', e.target.value)}
          placeholder="np. Facebook Feed, ocena ogólna KV, billboard..."
          list="ctx-datalist"
          className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]"
        />
        <datalist id="ctx-datalist">
          {['Facebook Feed','Instagram Stories','YouTube Pre-roll','TikTok In-Feed','Desktop Display','Mobile Banner','Ocena ogólna KV'].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

// ─── Główny komponent ─────────────────────────────────────────────────────────

export function NewSimulation() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<string[]>([]);
  useEffect(() => { getBrands().then(setBrands).catch(() => {}); }, []);

  // Tryb A/B
  const [abMode, setAbMode] = useState(false);
  // Targeting
  const [showTargeting, setShowTargeting] = useState(false);

  // Wariant A
  const [adA, setAdA] = useState<AdForm>(emptyAd());
  const [creativeA, setCreativeA] = useState<CreativeState>(emptyCreative());
  // Wariant B
  const [adB, setAdB] = useState<AdForm>(emptyAd());
  const [creativeB, setCreativeB] = useState<CreativeState>(emptyCreative());

  // Parametry symulacji
  const [totalRounds, setTotalRounds] = useState(5);
  const [platform, setPlatform] = useState<'facebook' | 'twitter'>('facebook');
  const [activeAgentRatio, setActiveAgentRatio] = useState(0.7);

  // Targeting
  const [targeting, setTargeting] = useState({
    gender: 'all', ageMin: '', ageMax: '', settlement: 'all', income: 'all',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyUploading = creativeA.uploading || creativeB.uploading;

  const canSubmit = !loading && !anyUploading && (!!adA.headline || !!creativeA.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const commonParams = {
      totalRounds,
      platform,
      activeAgentRatio,
      filterGender:     targeting.gender,
      filterAgeMin:     targeting.ageMin,
      filterAgeMax:     targeting.ageMax,
      filterSettlement: targeting.settlement,
      filterIncome:     targeting.income,
    };

    try {
      const idA = await startSimulation({
        ...commonParams,
        studyName:  adA.studyName || (abMode ? `${adA.brand || 'Wariant A'} – A` : adA.studyName),
        headline:   adA.headline,
        body:       adA.body,
        cta:        adA.cta,
        brand:      adA.brand,
        category:   adA.category,
        context:    adA.context,
        creativeId: creativeA.id ?? undefined,
      } as SimulationFormData);

      if (abMode) {
        const idB = await startSimulation({
          ...commonParams,
          studyName:  adB.studyName || `${adB.brand || 'Wariant B'} – B`,
          headline:   adB.headline,
          body:       adB.body,
          cta:        adB.cta,
          brand:      adB.brand,
          category:   adB.category,
          context:    adB.context,
          creativeId: creativeB.id ?? undefined,
        } as SimulationFormData);

        // Zapisz ID wariantu B – SimulationView pokaże link do porównania
        sessionStorage.setItem('abSimulationId', idB);
        sessionStorage.setItem('abSimulationLabel', adB.brand || 'Wariant B');
      } else {
        sessionStorage.removeItem('abSimulationId');
      }

      navigate(`/simulation/${idA}`);
    } catch (err: any) {
      setError(err.message ?? 'Błąd startu symulacji');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Network className="w-7 h-7 text-[#6366f1]" />
          <h1 className="text-2xl font-bold text-white">Symulacja społeczna v2</h1>
        </div>
        <p className="text-[#a1a1aa] text-sm">
          Multi-rundowa symulacja jak reklama rozprzestrzenia się przez sieć społeczną polskich personas.
          Agenci pamiętają poprzednie rundy, dyskutują, komentują i zmieniają opinie.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Opcje */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-8 flex-wrap">
            {/* A/B toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setAbMode((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${abMode ? 'bg-[#6366f1]' : 'bg-[#3f3f46]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${abMode ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-white flex items-center gap-1">
                  <FlaskConical className="w-3.5 h-3.5" /> Test A/B
                </div>
                <div className="text-xs text-[#a1a1aa]">Porównaj dwa warianty</div>
              </div>
            </label>

            {/* Targeting toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setShowTargeting((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${showTargeting ? 'bg-[#6366f1]' : 'bg-[#3f3f46]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showTargeting ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <div className="text-sm font-medium text-white flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Grupa docelowa
                </div>
                <div className="text-xs text-[#a1a1aa]">Ogranicz do segmentu</div>
              </div>
            </label>
          </div>
        </div>

        {/* Targeting */}
        {showTargeting && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-[#6366f1]" />
              <h3 className="text-sm font-semibold text-white">Filtry grupy docelowej</h3>
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">Płeć</label>
                <select
                  value={targeting.gender}
                  onChange={(e) => setTargeting((t) => ({ ...t, gender: e.target.value }))}
                  className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-2 py-1.5 text-sm focus:outline-none focus:border-[#6366f1]"
                >
                  <option value="all">Wszyscy</option>
                  <option value="male">Mężczyźni</option>
                  <option value="female">Kobiety</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">Wiek min</label>
                <input
                  type="number"
                  value={targeting.ageMin}
                  onChange={(e) => setTargeting((t) => ({ ...t, ageMin: e.target.value }))}
                  placeholder="18"
                  className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-2 py-1.5 text-sm focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">Wiek max</label>
                <input
                  type="number"
                  value={targeting.ageMax}
                  onChange={(e) => setTargeting((t) => ({ ...t, ageMax: e.target.value }))}
                  placeholder="65"
                  className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-2 py-1.5 text-sm focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">Miejscowość</label>
                <select
                  value={targeting.settlement}
                  onChange={(e) => setTargeting((t) => ({ ...t, settlement: e.target.value }))}
                  className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-2 py-1.5 text-sm focus:outline-none focus:border-[#6366f1]"
                >
                  {SETTLEMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#a1a1aa] mb-1">Dochód</label>
                <select
                  value={targeting.income}
                  onChange={(e) => setTargeting((t) => ({ ...t, income: e.target.value }))}
                  className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-2 py-1.5 text-sm focus:outline-none focus:border-[#6366f1]"
                >
                  {INCOMES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Materiał reklamowy */}
        {abMode ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Wariant A */}
            <div className="bg-[#18181b] border border-[#6366f1]/40 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-[#6366f1] uppercase tracking-widest">Wariant A</span>
              </div>
              <AdFields
                data={adA}
                onChange={setAdA}
                brands={brands}
                creative={creativeA}
                onCreativeChange={setCreativeA}
              />
            </div>
            {/* Wariant B */}
            <div className="bg-[#18181b] border border-[#f59e0b]/40 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-[#f59e0b] uppercase tracking-widest">Wariant B</span>
              </div>
              <AdFields
                data={adB}
                onChange={setAdB}
                brands={brands}
                creative={creativeB}
                onCreativeChange={setCreativeB}
              />
            </div>
          </div>
        ) : (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Materiał reklamowy</h2>
            <AdFields
              data={adA}
              onChange={setAdA}
              brands={brands}
              creative={creativeA}
              onCreativeChange={setCreativeA}
              showName
            />
          </div>
        )}

        {/* Nazwa badania w trybie A/B (wspólna) */}
        {abMode && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
            <label className="block text-xs text-[#a1a1aa] mb-1">Nazwa badania A/B</label>
            <input
              type="text"
              value={adA.studyName}
              onChange={(e) => { setAdA((d) => ({ ...d, studyName: e.target.value })); }}
              placeholder="np. Kampania T-Mobile Q2 2026 – A/B test"
              className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg text-white px-3 py-2 text-sm focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        )}

        {/* Parametry symulacji */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold">Parametry symulacji</h2>

          <div>
            <label className="block text-xs text-[#a1a1aa] mb-2">
              Liczba rund: <span className="text-white font-semibold">{totalRounds}</span>
            </label>
            <input
              type="range" min={3} max={15} value={totalRounds}
              onChange={(e) => setTotalRounds(Number(e.target.value))}
              className="w-full accent-[#6366f1]"
            />
            <div className="flex justify-between text-xs text-[#52525b] mt-1">
              <span>3 rundy (szybko)</span><span>15 rund (szczegółowo)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#a1a1aa] mb-1">Platforma symulacji WoMM</label>
            <p className="text-xs text-[#52525b] mb-2">Wpływa na dynamikę udostępnień i zasięgu w symulacji word-of-mouth</p>
            <div className="flex gap-3">
              {(['facebook', 'twitter'] as const).map((p) => (
                <button
                  key={p} type="button" onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    platform === p
                      ? 'bg-[#6366f1] border-[#6366f1] text-white'
                      : 'bg-[#09090b] border-[#3f3f46] text-[#a1a1aa] hover:border-[#6366f1]'
                  }`}
                >
                  {p === 'facebook' ? 'Facebook' : 'Twitter/X'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#a1a1aa] mb-2">
              Aktywni agenci per runda: <span className="text-white font-semibold">{Math.round(activeAgentRatio * 100)}%</span>
            </label>
            <input
              type="range" min={30} max={100} step={10}
              value={Math.round(activeAgentRatio * 100)}
              onChange={(e) => setActiveAgentRatio(Number(e.target.value) / 100)}
              className="w-full accent-[#6366f1]"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {abMode ? 'Tworzę symulacje A i B...' : 'Inicjalizuję symulację...'}
            </>
          ) : (
            <>
              <Network className="w-4 h-4" />
              {abMode ? 'Uruchom test A/B' : 'Uruchom symulację'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
