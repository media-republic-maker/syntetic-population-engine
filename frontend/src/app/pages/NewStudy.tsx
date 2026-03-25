import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { runStudy, uploadCreative, getBrands, mockCategories, mockContexts, type StudyResult } from '../utils/api';
import { Loader2, Filter, ImagePlus, X } from 'lucide-react';

export function NewStudy() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    getBrands().then(setBrands).catch(() => {});
  }, []);
  const [abMode, setAbMode] = useState(false);
  const [targeting, setTargeting] = useState(false);
  const [socialSpread, setSocialSpread] = useState(false);

  // Kreacja graficzna
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativePreview, setCreativePreview] = useState<string | null>(null);
  const [creativeId, setCreativeId] = useState<string | null>(null);
  const [creativeUploading, setCreativeUploading] = useState(false);
  const [creativeError, setCreativeError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    headline: '',
    body: '',
    cta: '',
    brand: '',
    category: '',
    context: '',
  });

  const [formDataB, setFormDataB] = useState({
    headline: '',
    body: '',
    cta: '',
  });

  const [targetingFilters, setTargetingFilters] = useState({
    gender: 'all',
    ageMin: '',
    ageMax: '',
    location: 'all',
    income: 'all',
  });

  const handleCreativeSelect = async (file: File) => {
    setCreativeError(null);
    setCreativeFile(file);
    setCreativePreview(URL.createObjectURL(file));
    setCreativeUploading(true);
    try {
      const id = await uploadCreative(file);
      setCreativeId(id);
    } catch (err: any) {
      setCreativeError(err.message ?? 'Błąd uploadu');
      setCreativeId(null);
    } finally {
      setCreativeUploading(false);
    }
  };

  const handleCreativeClear = () => {
    setCreativeFile(null);
    setCreativePreview(null);
    setCreativeId(null);
    setCreativeError(null);
  };

  const handleRunStudy = async () => {
    setIsRunning(true);
    setProgress(0);
    setProgressLabel('Uruchamianie badania...');

    await runStudy(
      {
        headline: formData.headline,
        body: formData.body,
        cta: formData.cta,
        brand: formData.brand,
        category: formData.category,
        context: formData.context,
        creativeId: creativeId ?? undefined,
        abMode,
        headlineB: formDataB.headline,
        bodyB: formDataB.body,
        ctaB: formDataB.cta,
        socialSpread,
        filterGender: targetingFilters.gender,
        filterAgeMin: targetingFilters.ageMin,
        filterAgeMax: targetingFilters.ageMax,
        filterSettlement: targetingFilters.location,
        filterIncome: targetingFilters.income,
      },
      (p, label) => { setProgress(p); setProgressLabel(label); },
      (result) => {
        setIsRunning(false);
        navigate(`/results/${result.id}`);
      },
      (msg) => {
        setIsRunning(false);
        setProgressLabel(`Błąd: ${msg}`);
      },
    );
  };

  const FormFields = ({ data, setData, variant = 'A' }: { data: any; setData: any; variant?: 'A' | 'B' }) => {
    const isVariantB = variant === 'B';
    const accentColor = isVariantB ? '#f59e0b' : '#6366f1';

    return (
      <div className="space-y-4">
        {!isVariantB && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="text-sm font-semibold text-white">Wariant {variant}</span>
          </div>
        )}

        {isVariantB && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
            <span className="text-sm font-semibold text-white">Wariant B</span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-white text-sm">Headline</Label>
          <Input
            value={data.headline}
            onChange={(e) => setData({ ...data, headline: e.target.value })}
            placeholder="Wpisz nagłówek kreacji..."
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

        {!isVariantB && (
          <>
            <div className="space-y-2">
              <Label className="text-white text-sm">Marka</Label>
              <Select value={data.brand} onValueChange={(value) => setData({ ...data, brand: value })}>
                <SelectTrigger className="bg-[#18181b] border-[#27272a] text-white rounded-lg">
                  <SelectValue placeholder="Wybierz markę..." />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a]">
                  {brands.map((brand) => (
                    <SelectItem key={brand} value={brand} className="text-white hover:bg-[#27272a]">
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={data.context} onValueChange={(value) => setData({ ...data, context: value })}>
                <SelectTrigger className="bg-[#18181b] border-[#27272a] text-white rounded-lg">
                  <SelectValue placeholder="Wybierz kontekst..." />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-[#27272a]">
                  {mockContexts.map((ctx) => (
                    <SelectItem key={ctx} value={ctx} className="text-white hover:bg-[#27272a]">
                      {ctx}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-white">Nowe badanie</h2>
        <p className="text-sm text-[#a1a1aa] mt-1">Skonfiguruj parametry badania i uruchom symulację na populacji syntetycznej</p>
      </div>

      {/* Options */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <Switch checked={abMode} onCheckedChange={setAbMode} className="data-[state=checked]:bg-[#6366f1]" />
            <div>
              <div className="text-sm font-medium text-white">Tryb A/B</div>
              <div className="text-xs text-[#a1a1aa]">Porównaj dwie wersje kreacji</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={targeting} onCheckedChange={setTargeting} className="data-[state=checked]:bg-[#6366f1]" />
            <div>
              <div className="text-sm font-medium text-white">Segment targeting</div>
              <div className="text-xs text-[#a1a1aa]">Ogranicz do wybranej grupy</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={socialSpread} onCheckedChange={setSocialSpread} className="data-[state=checked]:bg-[#7c3aed]" />
            <div>
              <div className="text-sm font-medium text-white">Social Spread</div>
              <div className="text-xs text-[#a1a1aa]">Symuluj potencjał viralowy</div>
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
        <div className="flex items-center gap-2 mb-4">
          <ImagePlus className="w-4 h-4 text-[#6366f1]" />
          <h3 className="text-sm font-semibold text-white">Kreacja graficzna</h3>
          <span className="text-xs text-[#52525b] ml-1">(opcjonalnie – JPG, PNG, WEBP)</span>
        </div>

        {!creativeFile ? (
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-[#27272a] rounded-lg cursor-pointer hover:border-[#6366f1] transition-colors">
            <ImagePlus className="w-6 h-6 text-[#52525b] mb-2" />
            <span className="text-sm text-[#52525b]">Kliknij lub przeciągnij plik kreacji</span>
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCreativeSelect(f); }}
            />
          </label>
        ) : (
          <div className="flex items-start gap-4">
            {creativePreview && (
              <img src={creativePreview} alt="podgląd kreacji" className="h-24 rounded-lg object-contain bg-[#0f0f11]" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white truncate">{creativeFile.name}</span>
                <button onClick={handleCreativeClear} className="text-[#52525b] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {creativeUploading && (
                <div className="flex items-center gap-2 mt-1">
                  <Loader2 className="w-3 h-3 text-[#6366f1] animate-spin" />
                  <span className="text-xs text-[#a1a1aa]">Przesyłanie...</span>
                </div>
              )}
              {creativeId && !creativeUploading && (
                <span className="text-xs text-green-400 mt-1 block">Gotowe – kreacja zostanie przesłana do modelu</span>
              )}
              {creativeError && (
                <span className="text-xs text-red-400 mt-1 block">{creativeError}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form */}
      <div className={abMode ? 'grid grid-cols-2 gap-6' : ''}>
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <FormFields data={formData} setData={setFormData} variant="A" />
        </div>

        {abMode && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <FormFields data={formDataB} setData={setFormDataB} variant="B" />
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-4">
            <Loader2 className="w-5 h-5 text-[#6366f1] animate-spin" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{progressLabel || 'Trwa symulacja...'}</span>
                <span className="text-sm text-[#a1a1aa]">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-[#27272a]" />
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleRunStudy}
          disabled={isRunning || (!formData.headline && !creativeId) || !formData.brand || creativeUploading}
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
