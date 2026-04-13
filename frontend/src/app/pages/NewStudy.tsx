import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { startSimulation, uploadCreative, getBrands, mockCategories } from '../utils/api';
import { Loader2, Filter, ImagePlus, X, Users, SlidersHorizontal } from 'lucide-react';

// ─── Komponenty pomocnicze (POZA NewStudy – inaczej React robi remount przy każdym re-renderze) ───

function BrandAutocomplete({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim().length > 0
    ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Wpisz nazwę marki..."
        autoComplete="off"
        className="bg-[#18181b] border-[#27272a] text-white placeholder:text-[#52525b] rounded-lg"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-[#18181b] border border-[#27272a] rounded-lg shadow-lg overflow-hidden">
          {filtered.map((brand) => (
            <li
              key={brand}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(brand);
                setOpen(false);
              }}
              className="px-3 py-2 text-sm text-white cursor-pointer hover:bg-[#27272a] transition-colors"
            >
              {brand}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── CreativeUploader ─────────────────────────────────────────────────────────

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

  const handleClear = () => onChange(emptyCreative());

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ImagePlus className="w-4 h-4 text-[#6366f1]" />
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-xs text-[#52525b] ml-1">(opcjonalnie – JPG, PNG, WEBP)</span>
      </div>

      {!state.file ? (
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#27272a] rounded-lg cursor-pointer hover:border-[#6366f1] transition-colors">
          <ImagePlus className="w-5 h-5 text-[#52525b] mb-1" />
          <span className="text-xs text-[#52525b]">Kliknij lub przeciągnij plik</span>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSelect(f); }}
          />
        </label>
      ) : (
        <div className="flex items-start gap-3">
          {state.preview && (
            <img src={state.preview} alt="podgląd" className="h-20 rounded-lg object-contain bg-[#0f0f11]" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white truncate">{state.file.name}</span>
              <button onClick={handleClear} className="text-[#52525b] hover:text-white flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
            {state.uploading && (
              <div className="flex items-center gap-1 mt-1">
                <Loader2 className="w-3 h-3 text-[#6366f1] animate-spin" />
                <span className="text-xs text-[#a1a1aa]">Przesyłanie...</span>
              </div>
            )}
            {state.id && !state.uploading && (
              <span className="text-xs text-green-400 mt-1 block">Gotowe</span>
            )}
            {state.error && (
              <span className="text-xs text-red-400 mt-1 block">{state.error}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FormFields ───────────────────────────────────────────────────────────────

function FormFields({
  data,
  setData,
  brands,
  creative,
  onCreativeChange,
}: {
  data: any;
  setData: (d: any) => void;
  brands: string[];
  creative?: CreativeState;
  onCreativeChange?: (s: CreativeState) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-white text-sm">Nazwa badania <span className="text-[#52525b] font-normal">(opcjonalnie)</span></Label>
        <Input
          value={data.studyName ?? ''}
          onChange={(e) => setData({ ...data, studyName: e.target.value })}
          placeholder="np. Biofarm Magne B6 – wrzesień 2025"
          className="bg-[#18181b] border-[#27272a] text-white placeholder:text-[#52525b] rounded-lg"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white text-sm">
          Headline{' '}
          {creative?.id && !data.headline && (
            <span className="text-[#52525b] font-normal text-xs">(opcjonalnie — oceniasz sam KV)</span>
          )}
        </Label>
        <Input
          value={data.headline}
          onChange={(e) => setData({ ...data, headline: e.target.value })}
          placeholder={creative?.id ? 'Opcjonalnie – KV wystarczy do testu...' : 'Wpisz nagłówek kreacji...'}
          className="bg-[#18181b] border-[#27272a] text-white placeholder:text-[#52525b] rounded-lg"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white text-sm">Body</Label>
        <Textarea
          value={data.body}
          onChange={(e) => setData({ ...data, body: e.target.value })}
          placeholder="Wpisz treść komunikatu..."
          rows={4}
          className="bg-[#18181b] border-[#27272a] text-white placeholder:text-[#52525b] rounded-lg resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white text-sm">CTA (Call to Action)</Label>
        <Input
          value={data.cta}
          onChange={(e) => setData({ ...data, cta: e.target.value })}
          placeholder="np. Kup teraz, Dowiedz się więcej..."
          className="bg-[#18181b] border-[#27272a] text-white placeholder:text-[#52525b] rounded-lg"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white text-sm">Marka</Label>
        <BrandAutocomplete
          value={data.brand}
          onChange={(v) => setData({ ...data, brand: v })}
          options={brands}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-white text-sm">Kategoria</Label>
        <Select value={data.category} onValueChange={(value) => setData({ ...data, category: value })}>
          <SelectTrigger className="bg-[#18181b] border-[#27272a] text-white rounded-lg">
            <SelectValue placeholder="Wybierz kategorię..." />
          </SelectTrigger>
          <SelectContent className="bg-[#18181b] border-[#27272a]">
            {mockCategories.map((cat) => (
              <SelectItem key={cat} value={cat} className="text-white hover:bg-[#27272a]">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-white text-sm">Kontekst ekspozycji</Label>
        <Input
          value={data.context}
          onChange={(e) => setData({ ...data, context: e.target.value })}
          placeholder="np. Facebook Feed, Ocena ogólna KV..."
          list="contexts-datalist"
          className="bg-[#18181b] border-[#27272a] text-white placeholder:text-[#52525b] rounded-lg"
        />
        <datalist id="contexts-datalist">
          <option value="Ocena ogólna KV" />
          <option value="Billboard / outdoor" />
          <option value="Opakowanie produktu" />
          <option value="Facebook Feed" />
          <option value="Instagram Stories" />
          <option value="YouTube Pre-roll" />
          <option value="TikTok In-Feed" />
          <option value="Desktop Display" />
          <option value="Mobile Banner" />
          <option value="LinkedIn Sponsored" />
          <option value="Pre-roll radio online" />
        </datalist>
      </div>
    </div>
  );
}

// ─── Główny komponent ──────────────────────────────────────────────────────────

export function NewStudy() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => {});
  }, []);

  const [targeting, setTargeting] = useState(false);
  const [totalRounds, setTotalRounds] = useState(5);
  const [platform, setPlatform] = useState<'facebook' | 'twitter'>('facebook');

  const [creative, setCreative] = useState<CreativeState>(emptyCreative());

  const [formData, setFormData] = useState({
    studyName: '',
    headline: '',
    body: '',
    cta: '',
    brand: '',
    category: '',
    context: '',
  });

  const [targetingFilters, setTargetingFilters] = useState({
    gender: 'all',
    ageMin: '',
    ageMax: '',
    location: 'all',
    income: 'all',
  });

  const handleRunStudy = async () => {
    setIsRunning(true);
    setProgressLabel('Tworzenie symulacji...');
    try {
      const id = await startSimulation({
        studyName: formData.studyName,
        headline: formData.headline,
        body: formData.body,
        cta: formData.cta,
        brand: formData.brand,
        category: formData.category,
        context: formData.context,
        creativeId: creative.id ?? undefined,
        totalRounds,
        platform,
        activeAgentRatio: 0.7,
        filterGender: targetingFilters.gender,
        filterAgeMin: targetingFilters.ageMin,
        filterAgeMax: targetingFilters.ageMax,
        filterSettlement: targetingFilters.location,
        filterIncome: targetingFilters.income,
      });
      navigate(`/simulation/${id}`);
    } catch (err: any) {
      setIsRunning(false);
      setProgressLabel(`Błąd: ${err.message ?? 'Sprawdź terminal serwera'}`);
    }
  };

  const anyCreativeUploading = creative.uploading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-white">Nowe badanie</h2>
        <p className="text-sm text-[#a1a1aa] mt-1">Skonfiguruj parametry badania i uruchom symulację na populacji syntetycznej</p>
      </div>

      {/* Options */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex items-center gap-3">
            <Switch checked={targeting} onCheckedChange={setTargeting} className="data-[state=checked]:bg-[#6366f1]" />
            <div>
              <div className="text-sm font-medium text-white">Segment targeting</div>
              <div className="text-xs text-[#a1a1aa]">Ogranicz do wybranej grupy</div>
            </div>
          </div>

          {/* Rounds */}
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-4 h-4 text-[#52525b]" />
            <div>
              <div className="text-xs text-[#a1a1aa] mb-1">Rundy symulacji: <span className="text-white font-semibold">{totalRounds}</span></div>
              <input
                type="range" min={3} max={10} value={totalRounds}
                onChange={(e) => setTotalRounds(Number(e.target.value))}
                className="w-32 accent-[#6366f1]"
              />
            </div>
          </div>

          {/* Platform */}
          <div className="flex items-center gap-3 ml-auto">
            <div>
              <div className="text-xs text-[#a1a1aa] mb-1">Platforma</div>
              <div className="flex gap-2">
                {(['facebook', 'twitter'] as const).map((p) => (
                  <button
                    key={p} type="button"
                    onClick={() => setPlatform(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      platform === p
                        ? 'bg-[#6366f1] border-[#6366f1] text-white'
                        : 'bg-[#0f0f11] border-[#27272a] text-[#a1a1aa] hover:border-[#6366f1]'
                    }`}
                  >
                    {p === 'facebook' ? 'Facebook' : 'Twitter/X'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Targeting Filters */}
      {targeting && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-[#6366f1]" />
            <h3 className="text-sm font-semibold text-white">Filtry segmentacji</h3>
          </div>

          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label className="text-white text-xs">Płeć</Label>
              <Select value={targetingFilters.gender} onValueChange={(value) => setTargetingFilters({ ...targetingFilters, gender: value })}>
                <SelectTrigger className="bg-[#0f0f11] border-[#27272a] text-white text-sm rounded-lg h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a]">
                  <SelectItem value="all" className="text-white text-sm">Wszyscy</SelectItem>
                  <SelectItem value="male" className="text-white text-sm">Mężczyźni</SelectItem>
                  <SelectItem value="female" className="text-white text-sm">Kobiety</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white text-xs">Wiek min</Label>
              <Input
                type="number"
                value={targetingFilters.ageMin}
                onChange={(e) => setTargetingFilters({ ...targetingFilters, ageMin: e.target.value })}
                placeholder="18"
                className="bg-[#0f0f11] border-[#27272a] text-white text-sm rounded-lg h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white text-xs">Wiek max</Label>
              <Input
                type="number"
                value={targetingFilters.ageMax}
                onChange={(e) => setTargetingFilters({ ...targetingFilters, ageMax: e.target.value })}
                placeholder="65"
                className="bg-[#0f0f11] border-[#27272a] text-white text-sm rounded-lg h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white text-xs">Miejscowość</Label>
              <Select value={targetingFilters.location} onValueChange={(value) => setTargetingFilters({ ...targetingFilters, location: value })}>
                <SelectTrigger className="bg-[#0f0f11] border-[#27272a] text-white text-sm rounded-lg h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a]">
                  <SelectItem value="all" className="text-white text-sm">Wszystkie</SelectItem>
                  <SelectItem value="urban" className="text-white text-sm">Miasta &gt;500k</SelectItem>
                  <SelectItem value="suburban" className="text-white text-sm">Miasta 100-500k</SelectItem>
                  <SelectItem value="rural" className="text-white text-sm">Mniejsze miasta i wieś</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white text-xs">Dochód</Label>
              <Select value={targetingFilters.income} onValueChange={(value) => setTargetingFilters({ ...targetingFilters, income: value })}>
                <SelectTrigger className="bg-[#0f0f11] border-[#27272a] text-white text-sm rounded-lg h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a]">
                  <SelectItem value="all" className="text-white text-sm">Wszystkie</SelectItem>
                  <SelectItem value="low" className="text-white text-sm">Niski</SelectItem>
                  <SelectItem value="medium" className="text-white text-sm">Średni</SelectItem>
                  <SelectItem value="high" className="text-white text-sm">Wysoki</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Creative Upload */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <CreativeUploader state={creative} onChange={setCreative} />
      </div>

      {/* Form */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <FormFields
          data={formData}
          setData={setFormData}
          brands={brands}
          creative={creative}
          onCreativeChange={setCreative}
        />
      </div>

      {/* Status */}
      {(isRunning || progressLabel) && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-3">
            {isRunning && <Loader2 className="w-5 h-5 text-[#6366f1] animate-spin flex-shrink-0" />}
            <span className="text-sm text-white">{progressLabel || 'Tworzenie symulacji...'}</span>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleRunStudy}
          disabled={isRunning || (!formData.headline && !creative.id) || !formData.brand || anyCreativeUploading}
          className="bg-[#6366f1] hover:bg-[#5558e3] text-white px-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Trwa badanie...
            </>
          ) : (
            'Uruchom badanie'
          )}
        </Button>
      </div>
    </div>
  );
}
