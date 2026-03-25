import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Download, Plus, TrendingUp, TrendingDown, Eye, Heart, ShoppingCart, Shield, Share2, MessageCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { type StudyResult } from '../utils/api';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../components/ui/drawer';

export function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<StudyResult | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // Load result from sessionStorage
    const stored = sessionStorage.getItem('currentStudy');
    if (stored) {
      setResult(JSON.parse(stored));
    } else {
      // Mock result for direct navigation
      const mockResult: StudyResult = {
        id: id || 'mock',
        campaignName: 'Przykładowe badanie',
        date: new Date().toISOString(),
        metrics: {
          attention: 7.8,
          resonance: 8.1,
          purchaseIntentDelta: 14,
          trustDelta: 6,
        },
        segmentData: {
          age: [
            { segment: '18-24', attention: 8.2, resonance: 7.9, purchaseIntent: 15 },
            { segment: '25-34', attention: 7.8, resonance: 8.1, purchaseIntent: 18 },
            { segment: '35-44', attention: 7.5, resonance: 7.3, purchaseIntent: 12 },
            { segment: '45-54', attention: 6.9, resonance: 6.8, purchaseIntent: 8 },
            { segment: '55+', attention: 6.2, resonance: 6.1, purchaseIntent: 5 },
          ],
          gender: [
            { segment: 'Kobiety', attention: 7.8, resonance: 8.0, purchaseIntent: 14 },
            { segment: 'Mężczyźni', attention: 7.2, resonance: 7.1, purchaseIntent: 11 },
          ],
          location: [
            { segment: 'Miasta >500k', attention: 8.1, resonance: 7.8, purchaseIntent: 16 },
            { segment: 'Miasta 100-500k', attention: 7.4, resonance: 7.2, purchaseIntent: 12 },
            { segment: 'Miasta <100k', attention: 6.8, resonance: 6.9, purchaseIntent: 9 },
            { segment: 'Wieś', attention: 6.5, resonance: 6.6, purchaseIntent: 7 },
          ],
        },
        topRecall: [
          'Produkt był widoczny i zapadał w pamięć',
          'Podobała mi się kolorystyka i dynamika',
          'Ciekawy przekaz, ale trochę zbyt agresywny',
          'Marka jest rozpoznawalna, to dodaje wartości',
          'Czuję, że to dla młodszej grupy docelowej',
        ],
        womQuotes: [
          '"Pokazałbym to znajomym, bo to coś nowego"',
          '"Fajne, ale nie wiem czy bym kupił"',
          '"To ma potencjał viralowy, szczególnie na TikToku"',
          '"Nie dla mnie, ale rozumiem grupę docelową"',
        ],
        rejectionSignals: [
          'Zbyt nachalny przekaz (23% respondentów)',
          'Niejasny CTA (18% respondentów)',
          'Nie pasuje do mojego stylu życia (15% respondentów)',
        ],
      };
      setResult(mockResult);
    }
  }, [id]);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-[#a1a1aa]">Ładowanie wyników...</div>
      </div>
    );
  }

  const radarData = [
    { metric: 'Attention', value: result.metrics.attention, fullMark: 10 },
    { metric: 'Resonance', value: result.metrics.resonance, fullMark: 10 },
    { metric: 'Purchase Intent', value: result.metrics.purchaseIntentDelta / 2, fullMark: 10 },
    { metric: 'Trust', value: result.metrics.trustDelta / 1.5, fullMark: 10 },
  ];

  const handleExportPDF = () => {
    alert('Export PDF - funkcjonalność zostanie wkrótce zaimplementowana');
  };

  const openSegmentDrawer = (segmentType: string, data: any) => {
    setSelectedSegment({ type: segmentType, data });
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Wyniki badania</h2>
          <p className="text-sm text-[#a1a1aa] mt-1">
            {new Date(result.date).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExportPDF} variant="outline" className="border-[#27272a] text-white hover:bg-[#27272a] rounded-lg">
            <Download className="w-4 h-4 mr-2" />
            Pobierz PDF
          </Button>
          <Link to="/new-study">
            <Button className="bg-[#6366f1] hover:bg-[#5558e3] text-white rounded-lg">
              <Plus className="w-4 h-4 mr-2" />
              Nowe badanie
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Attention Score"
          value={result.metrics.attention.toFixed(1)}
          icon={Eye}
          color="#6366f1"
        />
        <MetricCard
          label="Resonance"
          value={result.metrics.resonance.toFixed(1)}
          icon={Heart}
          color="#8b5cf6"
        />
        <MetricCard
          label="Purchase Intent Δ"
          value={`+${result.metrics.purchaseIntentDelta}%`}
          icon={ShoppingCart}
          color="#10b981"
          trend="up"
        />
        <MetricCard
          label="Trust Δ"
          value={`+${result.metrics.trustDelta}%`}
          icon={Shield}
          color="#10b981"
          trend="up"
        />
      </div>

      {/* Radar Chart */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Profil metryczny</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Segment Tables */}
      <div className="grid grid-cols-3 gap-4">
        <SegmentCard
          title="Segmentacja wiekowa"
          data={result.segmentData.age}
          onViewDetails={() => openSegmentDrawer('age', result.segmentData.age)}
        />
        <SegmentCard
          title="Segmentacja płciowa"
          data={result.segmentData.gender}
          onViewDetails={() => openSegmentDrawer('gender', result.segmentData.gender)}
        />
        <SegmentCard
          title="Segmentacja geograficzna"
          data={result.segmentData.location}
          onViewDetails={() => openSegmentDrawer('location', result.segmentData.location)}
        />
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-5 h-5 text-[#6366f1]" />
            <h3 className="font-semibold text-white">Top Recall</h3>
          </div>
          <ul className="space-y-2">
            {result.topRecall.map((item, i) => (
              <li key={i} className="text-sm text-[#a1a1aa] pl-4 border-l-2 border-[#27272a]">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-[#10b981]" />
            <h3 className="font-semibold text-white">WOM Quotes</h3>
          </div>
          <ul className="space-y-3">
            {result.womQuotes.map((quote, i) => (
              <li key={i} className="text-sm text-[#a1a1aa] italic">
                {quote}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="font-semibold text-white">Sygnały odrzucenia</h3>
          </div>
          <ul className="space-y-2">
            {result.rejectionSignals.map((signal, i) => (
              <li key={i} className="text-sm text-[#fca5a5] pl-4 border-l-2 border-[#ef4444]/30">
                {signal}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Social Spread */}
      {result.socialSpread && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-[#7c3aed]" />
            <h3 className="text-lg font-semibold text-white">Social Spread Analysis</h3>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="mb-4">
                <div className="text-sm text-[#a1a1aa] mb-2">Viral Score</div>
                <div className="text-5xl font-bold text-[#7c3aed]">{result.socialSpread.viralScore.toFixed(0)}</div>
              </div>

              <div className="space-y-3 mt-6">
                {result.socialSpread.chains.map((chain, i) => (
                  <div key={i} className="bg-[#0f0f11] rounded-lg p-4 border border-[#27272a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">Level {chain.depth}</span>
                      <span className="text-xs text-[#a1a1aa]">Reach: {chain.reach}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#27272a] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#7c3aed] rounded-full transition-all"
                          style={{ width: `${(chain.engagement / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-[#a1a1aa] w-12 text-right">{chain.engagement.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm text-[#a1a1aa] mb-4">Propagacja w czasie</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.socialSpread.chains}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="depth" tick={{ fill: '#a1a1aa' }} label={{ value: 'Depth', position: 'insideBottom', offset: -5, fill: '#a1a1aa' }} />
                    <YAxis tick={{ fill: '#a1a1aa' }} label={{ value: 'Reach', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="reach" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Segment Deep Dive Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-[#18181b] border-t border-[#27272a] max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle className="text-white">
              {selectedSegment?.type === 'age' && 'Analiza segmentu wiekowego'}
              {selectedSegment?.type === 'gender' && 'Analiza segmentu płciowego'}
              {selectedSegment?.type === 'location' && 'Analiza segmentu geograficznego'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-6">
            {selectedSegment && (
              <div className="space-y-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedSegment.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="segment" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#a1a1aa' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="attention" fill="#6366f1" name="Attention" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resonance" fill="#8b5cf6" name="Resonance" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="purchaseIntent" fill="#10b981" name="Purchase Intent" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {selectedSegment.data.map((seg: any, i: number) => (
                    <div key={i} className="bg-[#0f0f11] border border-[#27272a] rounded-lg p-4">
                      <div className="text-sm font-medium text-white mb-3">{seg.segment}</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#a1a1aa]">Attention:</span>
                          <span className="text-white font-medium">{seg.attention.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#a1a1aa]">Resonance:</span>
                          <span className="text-white font-medium">{seg.resonance.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#a1a1aa]">Purchase Intent:</span>
                          <span className="text-[#10b981] font-medium">+{seg.purchaseIntent}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, trend }: any) {
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && (
          <div className={trend === 'up' ? 'text-[#10b981]' : 'text-[#ef4444]'}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        )}
      </div>
      <div className="text-sm text-[#a1a1aa] mb-1">{label}</div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

function SegmentCard({ title, data, onViewDetails }: any) {
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        <button
          onClick={onViewDetails}
          className="text-[#6366f1] hover:text-[#5558e3] text-xs flex items-center gap-1 transition-colors"
        >
          Szczegóły
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-3">
        {data.slice(0, 4).map((item: any, i: number) => (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#a1a1aa]">{item.segment}</span>
              <span className="text-white font-medium">{item.attention.toFixed(1)}</span>
            </div>
            <div className="h-1.5 bg-[#27272a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6366f1] rounded-full transition-all"
                style={{ width: `${(item.attention / 10) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
