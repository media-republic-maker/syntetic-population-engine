// ─────────────────────────────────────────────────────────────────────────────
// Serwer HTTP – formularz + A/B testing + SSE streaming + PDF export
// tsx src/server.ts  →  http://localhost:3000
// ─────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generatePopulation } from "./personas/generator.js";
import { runStudy } from "./engine/runner.js";
import { aggregateResults, type StudyReport } from "./reports/aggregator.js";
import { generatePDF } from "./reports/pdf.js";
import type { AdMaterial, Persona } from "./personas/schema.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const DATA_DIR = join(process.cwd(), "data");
const POPULATION_PATH = join(DATA_DIR, "population.json");
const RESULTS_DIR = join(DATA_DIR, "results");

function getPopulation(): Persona[] {
  if (existsSync(POPULATION_PATH)) {
    return JSON.parse(readFileSync(POPULATION_PATH, "utf8")) as Persona[];
  }
  const size = parseInt(process.env.POPULATION_SIZE ?? "50", 10);
  const pop = generatePopulation(size);
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(POPULATION_PATH, JSON.stringify(pop, null, 2), "utf8");
  return pop;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function adFromParams(p: URLSearchParams, prefix = ""): AdMaterial {
  const g = (k: string) => p.get(prefix + k) || undefined;
  return {
    headline: g("headline") ?? "",
    body: g("body") ?? "",
    cta: g("cta") ?? "",
    brandName: g("brandName"),
    productCategory: g("productCategory") as AdMaterial["productCategory"],
    context: g("context"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = `
  <option value="">-- dowolna --</option>
  <option value="fmcg">FMCG</option>
  <option value="electronics">Elektronika</option>
  <option value="fashion">Moda</option>
  <option value="financial_services">Usługi finansowe</option>
  <option value="automotive">Motoryzacja</option>
  <option value="food_delivery">Dostawa jedzenia</option>
  <option value="travel">Podróże</option>
  <option value="healthcare">Zdrowie</option>
  <option value="entertainment">Rozrywka</option>
  <option value="home_appliances">AGD/RTV</option>`;

const HTML = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synthetic Population Sandbox</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f0f11; color: #e4e4e7; min-height: 100vh; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
    .subtitle { color: #71717a; font-size: 0.875rem; margin-bottom: 2rem; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.8rem; color: #a1a1aa; margin-bottom: 0.4rem; }
    input, textarea, select { width: 100%; background: #09090b; border: 1px solid #3f3f46; border-radius: 8px; color: #e4e4e7; padding: 0.6rem 0.75rem; font-size: 0.9rem; margin-bottom: 1rem; outline: none; transition: border-color 0.15s; }
    input:focus, textarea:focus, select:focus { border-color: #6366f1; }
    textarea { resize: vertical; min-height: 90px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .ab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 640px) { .ab-grid, .row { grid-template-columns: 1fr; } }
    .ab-label { font-size: 0.75rem; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem; }
    .ab-label.b { color: #f59e0b; }
    button { background: #6366f1; color: #fff; border: none; border-radius: 8px; padding: 0.7rem 1.5rem; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: background 0.15s; }
    button:hover { background: #4f46e5; }
    button:disabled { background: #3f3f46; cursor: not-allowed; }
    .btn-outline { background: transparent; border: 1px solid #3f3f46; color: #a1a1aa; margin-left: 0.75rem; }
    .btn-outline:hover { border-color: #6366f1; color: #e4e4e7; background: transparent; }
    .btn-pdf { background: #166534; }
    .btn-pdf:hover { background: #15803d; }
    .toggle-ab { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; cursor: pointer; font-size: 0.875rem; color: #a1a1aa; }
    .toggle-ab input { width: auto; margin: 0; accent-color: #6366f1; }
    #abSection { display: none; }
    .progress-bar-wrap { background: #27272a; border-radius: 99px; height: 6px; margin: 0.75rem 0; overflow: hidden; }
    .progress-bar { background: #6366f1; height: 100%; border-radius: 99px; width: 0%; transition: width 0.3s; }
    .progress-label { font-size: 0.8rem; color: #71717a; }
    #progress, #results { display: none; }
    .section-title { font-size: 0.75rem; color: #71717a; text-transform: uppercase; letter-spacing: 0.06em; margin: 1.25rem 0 0.75rem; font-weight: 600; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
    @media (max-width: 600px) { .metric-grid { grid-template-columns: repeat(2, 1fr); } }
    .metric { background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 1rem; text-align: center; }
    .metric-value { font-size: 1.75rem; font-weight: 700; color: #6366f1; }
    .metric-value.ab-b { color: #f59e0b; }
    .metric-label { font-size: 0.7rem; color: #71717a; margin-top: 0.2rem; }
    .segment-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .segment-table th { text-align: left; color: #71717a; padding: 0.4rem 0.6rem; border-bottom: 1px solid #27272a; }
    .segment-table td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #18181b; }
    .tag { display: inline-block; background: #27272a; border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.75rem; margin: 0.2rem; }
    .positive { color: #22c55e; }
    .negative { color: #ef4444; }
    .neutral { color: #a1a1aa; }
    .chart-wrap { position: relative; height: 220px; margin: 1rem 0; }
    .ab-winner { display: inline-block; background: #14532d; color: #86efac; border-radius: 6px; padding: 0.2rem 0.6rem; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
  </style>
</head>
<body>
  <h1>Synthetic Population Sandbox</h1>
  <p class="subtitle">Pre-test komunikacji reklamowej na syntetycznej populacji polskich konsumentów</p>

  <div class="card">
    <label class="toggle-ab">
      <input type="checkbox" id="abToggle"> Tryb A/B – porównaj dwa warianty
    </label>

    <form id="studyForm">
      <div class="ab-grid">
        <div>
          <div class="ab-label" id="labelA">Reklama</div>
          <label>Headline *</label>
          <input type="text" name="headline" required placeholder="Nagłówek reklamy">
          <label>Body *</label>
          <textarea name="body" required placeholder="Treść reklamy..."></textarea>
          <label>CTA *</label>
          <input type="text" name="cta" required placeholder="Wezwanie do działania">
          <div class="row">
            <div><label>Marka</label><input type="text" name="brandName" placeholder="np. Nike"></div>
            <div><label>Kategoria</label><select name="productCategory">${CATEGORY_OPTIONS}</select></div>
          </div>
          <label>Kontekst ekspozycji</label>
          <input type="text" name="context" placeholder="np. Pre-roll YouTube">
        </div>

        <div id="abSection">
          <div class="ab-label b">Wariant B</div>
          <label>Headline *</label>
          <input type="text" name="headlineB" placeholder="Nagłówek wariantu B">
          <label>Body *</label>
          <textarea name="bodyB" placeholder="Treść wariantu B..."></textarea>
          <label>CTA *</label>
          <input type="text" name="ctaB" placeholder="CTA wariantu B">
          <div class="row">
            <div><label>Marka</label><input type="text" name="brandNameB" placeholder="np. Nike"></div>
            <div><label>Kategoria</label><select name="productCategoryB">${CATEGORY_OPTIONS}</select></div>
          </div>
          <label>Kontekst ekspozycji</label>
          <input type="text" name="contextB" placeholder="np. Baner display">
        </div>
      </div>

      <div style="margin-top:1rem">
        <button type="submit" id="submitBtn">Uruchom badanie</button>
      </div>
    </form>
  </div>

  <div id="progress">
    <div class="card">
      <div class="progress-label" id="progressLabel">Inicjalizacja...</div>
      <div class="progress-bar-wrap"><div class="progress-bar" id="progressBar"></div></div>
    </div>
  </div>

  <div id="results">
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
        <span class="section-title" style="margin:0">Wyniki</span>
        <div>
          <button class="btn-pdf" id="pdfBtn" onclick="downloadPDF()">Pobierz PDF</button>
        </div>
      </div>

      <div class="section-title" id="aggregateTitle">Wyniki agregat</div>
      <div class="metric-grid" id="metricGrid"></div>

      <div class="chart-wrap"><canvas id="radarChart"></canvas></div>

      <div class="section-title">Segmentacja wiekowa</div>
      <table class="segment-table" id="ageTable"><thead></thead><tbody></tbody></table>

      <div class="chart-wrap"><canvas id="ageChart"></canvas></div>

      <div class="section-title">Segmentacja płci</div>
      <table class="segment-table" id="genderTable"><thead></thead><tbody></tbody></table>

      <div class="section-title">Segmentacja typ miejscowości</div>
      <table class="segment-table" id="settlementTable"><thead></thead><tbody></tbody></table>

      <div class="section-title">Co zapamiętali (top recall)</div>
      <div id="recallList"></div>

      <div class="section-title">Co powiedzieliby znajomemu (WOM)</div>
      <div id="womList"></div>

      <div class="section-title">Sygnały odrzucenia</div>
      <div id="rejectionList"></div>
    </div>
  </div>

  <script>
    let lastResult = null;
    let isAB = false;

    document.getElementById('abToggle').addEventListener('change', function() {
      isAB = this.checked;
      document.getElementById('abSection').style.display = isAB ? 'block' : 'none';
      document.getElementById('labelA').textContent = isAB ? 'Wariant A' : 'Reklama';
      const bInputs = document.querySelectorAll('[name$="B"]');
      bInputs.forEach(el => el.required = isAB);
    });

    document.getElementById('studyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = true;
      document.getElementById('progress').style.display = 'block';
      document.getElementById('results').style.display = 'none';
      setProgress(0, 'Uruchamianie badania...');

      const params = new URLSearchParams({
        headline: data.headline, body: data.body, cta: data.cta,
        brandName: data.brandName || '', productCategory: data.productCategory || '', context: data.context || '',
        ab: isAB ? '1' : '0',
        headlineB: data.headlineB || '', bodyB: data.bodyB || '', ctaB: data.ctaB || '',
        brandNameB: data.brandNameB || '', productCategoryB: data.productCategoryB || '', contextB: data.contextB || '',
      });

      const es = new EventSource('/study?' + params);

      es.addEventListener('progress', (e) => {
        const { done, total, phase } = JSON.parse(e.data);
        const pct = done / total * 100;
        setProgress(isAB ? pct / 2 + (phase === 'B' ? 50 : 0) : pct,
          phase ? \`Wariant \${phase}: \${done}/\${total} botów\` : \`\${done}/\${total} botów\`);
      });

      es.addEventListener('result', (e) => {
        es.close();
        submitBtn.disabled = false;
        lastResult = JSON.parse(e.data);
        renderResults(lastResult);
        setProgress(100, 'Badanie zakończone ✓');
      });

      es.addEventListener('error', (e) => {
        es.close();
        submitBtn.disabled = false;
        setProgress(0, 'Błąd: ' + (e.data ? JSON.parse(e.data).message : 'sprawdź terminal serwera'));
      });
    });

    function setProgress(pct, label) {
      document.getElementById('progressBar').style.width = pct + '%';
      document.getElementById('progressLabel').textContent = label;
    }

    function cd(val) {
      const v = Number(val);
      const sign = v > 0 ? '+' : '';
      const cls = v > 0 ? 'positive' : v < 0 ? 'negative' : 'neutral';
      return \`<span class="\${cls}">\${sign}\${v}</span>\`;
    }

    let radarChart, ageChart;

    function renderResults(data) {
      document.getElementById('results').style.display = 'block';
      const { reportA, reportB, adA } = data;
      const isABResult = !!reportB;

      document.getElementById('aggregateTitle').textContent = isABResult ? 'Wyniki agregat – A/B' : 'Wyniki agregat';

      // Metrics
      const a = reportA.aggregate;
      const b = reportB?.aggregate;
      const metrics = [
        { label: 'Attention', valA: a.attentionScore, valB: b?.attentionScore, suffix: '/10' },
        { label: 'Resonance', valA: a.resonanceScore, valB: b?.resonanceScore, suffix: '/10' },
        { label: 'Purchase Intent Δ', valA: a.purchaseIntentDelta, valB: b?.purchaseIntentDelta, delta: true },
        { label: 'Trust Impact Δ', valA: a.trustImpact, valB: b?.trustImpact, delta: true },
      ];

      document.getElementById('metricGrid').innerHTML = metrics.map(m => {
        const winner = isABResult && m.valB !== undefined && m.valA !== m.valB
          ? (m.valB > m.valA ? '<span class="ab-winner">B wygrywa</span>' : '<span class="ab-winner" style="background:#1e3a5f;color:#93c5fd">A wygrywa</span>')
          : '';
        const valA = m.delta ? cd(m.valA) : \`<span style="color:#6366f1">\${m.valA}\${m.suffix ?? ''}</span>\`;
        const valB = m.valB !== undefined ? (m.delta ? cd(m.valB) : \`<span style="color:#f59e0b">\${m.valB}\${m.suffix ?? ''}</span>\`) : '';
        return \`<div class="metric">
          <div class="metric-value">\${valA}\${isABResult ? \` / \${valB}\` : ''}</div>
          <div class="metric-label">\${m.label}\${winner}</div>
        </div>\`;
      }).join('');

      // Radar chart
      renderRadar(reportA, reportB);

      // Segment tables
      const isABR = !!reportB;
      const thead = isABR
        ? '<tr><th>Segment</th><th>n</th><th>ATT A→B</th><th>RES A→B</th><th>PI Δ A→B</th><th>TR Δ A→B</th></tr>'
        : '<tr><th>Segment</th><th>n</th><th>Attention</th><th>Resonance</th><th>Purchase Δ</th><th>Trust Δ</th></tr>';

      fillSegmentTable('ageTable', thead, reportA.byAgeGroup, reportB?.byAgeGroup);
      renderAgeChart(reportA, reportB);
      fillSegmentTable('genderTable', thead, reportA.byGender, reportB?.byGender);
      fillSegmentTable('settlementTable', thead, reportA.bySettlement, reportB?.bySettlement);

      document.getElementById('recallList').innerHTML =
        reportA.topRecalls.map(r => \`<span class="tag">\${r}</span>\`).join('') +
        (reportB ? '<br><span style="color:#f59e0b;font-size:.75rem">B: </span>' + reportB.topRecalls.map(r => \`<span class="tag" style="border-color:#78350f">\${r}</span>\`).join('') : '');

      document.getElementById('womList').innerHTML =
        reportA.topWom.slice(0,3).map(r => \`<div style="margin-bottom:.4rem;font-size:.875rem">„\${r}"</div>\`).join('');

      document.getElementById('rejectionList').innerHTML =
        reportA.allRejections.map(r => \`<span class="tag" style="color:#ef4444">\${r}</span>\`).join('') +
        (reportB?.allRejections.length ? '<br><span style="color:#f59e0b;font-size:.75rem">B: </span>' + reportB.allRejections.map(r => \`<span class="tag" style="color:#f59e0b">\${r}</span>\`).join('') : '');
    }

    function fillSegmentTable(id, thead, segsA, segsB) {
      document.querySelector('#' + id + ' thead').innerHTML = thead;
      const isAB = !!segsB;
      document.querySelector('#' + id + ' tbody').innerHTML = Object.entries(segsA).map(([k, s]) => {
        const b = segsB?.[k];
        if (isAB && b) {
          return \`<tr>
            <td>\${s.label}</td><td>\${s.count}</td>
            <td>\${s.attentionScore} → \${b.attentionScore}</td>
            <td>\${s.resonanceScore} → \${b.resonanceScore}</td>
            <td>\${cd(s.purchaseIntentDelta)} → \${cd(b.purchaseIntentDelta)}</td>
            <td>\${cd(s.trustImpact)} → \${cd(b.trustImpact)}</td>
          </tr>\`;
        }
        return \`<tr>
          <td>\${s.label}</td><td>\${s.count}</td>
          <td>\${s.attentionScore}</td><td>\${s.resonanceScore}</td>
          <td>\${cd(s.purchaseIntentDelta)}</td><td>\${cd(s.trustImpact)}</td>
        </tr>\`;
      }).join('');
    }

    function renderRadar(repA, repB) {
      if (radarChart) radarChart.destroy();
      const a = repA.aggregate;
      const labels = ['Attention', 'Resonance', 'Purchase Intent', 'Trust'];
      const normalize = (val, min, max) => ((val - min) / (max - min)) * 10;
      const datasetsA = {
        label: repB ? 'Wariant A' : 'Wyniki',
        data: [a.attentionScore, a.resonanceScore, normalize(a.purchaseIntentDelta, -5, 5), normalize(a.trustImpact, -5, 5)],
        borderColor: '#6366f1', backgroundColor: '#6366f130', pointBackgroundColor: '#6366f1',
      };
      const datasets = [datasetsA];
      if (repB) {
        const b = repB.aggregate;
        datasets.push({
          label: 'Wariant B',
          data: [b.attentionScore, b.resonanceScore, normalize(b.purchaseIntentDelta, -5, 5), normalize(b.trustImpact, -5, 5)],
          borderColor: '#f59e0b', backgroundColor: '#f59e0b20', pointBackgroundColor: '#f59e0b',
        });
      }
      radarChart = new Chart(document.getElementById('radarChart'), {
        type: 'radar',
        data: { labels, datasets },
        options: { scales: { r: { min: 0, max: 10, ticks: { color: '#52525b', stepSize: 2 }, grid: { color: '#27272a' }, pointLabels: { color: '#a1a1aa', font: { size: 11 } } } }, plugins: { legend: { labels: { color: '#a1a1aa' } } } },
      });
    }

    function renderAgeChart(repA, repB) {
      if (ageChart) ageChart.destroy();
      const labels = Object.values(repA.byAgeGroup).map(s => s.label);
      const attA = Object.values(repA.byAgeGroup).map(s => s.attentionScore);
      const datasets = [{ label: repB ? 'Attention A' : 'Attention', data: attA, backgroundColor: '#6366f1aa', borderRadius: 4 }];
      if (repB) {
        datasets.push({ label: 'Attention B', data: Object.values(repB.byAgeGroup).map(s => s.attentionScore), backgroundColor: '#f59e0baa', borderRadius: 4 });
      }
      ageChart = new Chart(document.getElementById('ageChart'), {
        type: 'bar',
        data: { labels, datasets },
        options: { scales: { y: { min: 0, max: 10, grid: { color: '#27272a' }, ticks: { color: '#71717a' } }, x: { grid: { color: '#27272a' }, ticks: { color: '#71717a' } } }, plugins: { legend: { labels: { color: '#a1a1aa' } } } },
      });
    }

    async function downloadPDF() {
      if (!lastResult) return;
      const btn = document.getElementById('pdfBtn');
      btn.disabled = true;
      btn.textContent = 'Generuję...';
      const res = await fetch('/export-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lastResult) });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'raport-sandbox.pdf';
      a.click();
      URL.revokeObjectURL(url);
      btn.disabled = false;
      btn.textContent = 'Pobierz PDF';
    }
  </script>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // ── Strona główna ──────────────────────────────────────────────────────────
  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
    return;
  }

  // ── SSE – badanie (z opcjonalnym A/B) ─────────────────────────────────────
  if (url.pathname === "/study" && req.method === "GET") {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.writeHead(500); res.end(); return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const send = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      const population = getPopulation();
      const adA = adFromParams(url.searchParams);
      const isAB = url.searchParams.get("ab") === "1";

      const responsesA = await runStudy(population, adA, (done, total) =>
        send("progress", { done, total, phase: isAB ? "A" : undefined })
      );
      const reportA = aggregateResults(population, responsesA);

      let reportB: StudyReport | undefined;
      if (isAB) {
        const adB = adFromParams(url.searchParams, "B" as never);
        // adFromParams z prefixem B: headlineB → headline etc.
        const adBFixed: AdMaterial = {
          headline: url.searchParams.get("headlineB") ?? "",
          body: url.searchParams.get("bodyB") ?? "",
          cta: url.searchParams.get("ctaB") ?? "",
          brandName: url.searchParams.get("brandNameB") || undefined,
          productCategory: (url.searchParams.get("productCategoryB") || undefined) as AdMaterial["productCategory"],
          context: url.searchParams.get("contextB") || undefined,
        };
        const responsesB = await runStudy(population, adBFixed, (done, total) =>
          send("progress", { done, total, phase: "B" })
        );
        reportB = aggregateResults(population, responsesB);

        // Zapis
        mkdirSync(RESULTS_DIR, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        writeFileSync(join(RESULTS_DIR, `report_ab_${ts}.json`), JSON.stringify({ adA, adB: adBFixed, reportA, reportB }, null, 2), "utf8");

        send("result", { reportA, reportB, adA, adB: adBFixed });
      } else {
        mkdirSync(RESULTS_DIR, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        writeFileSync(join(RESULTS_DIR, `report_${ts}.json`), JSON.stringify({ adA, reportA, responsesA }, null, 2), "utf8");

        send("result", { reportA, adA });
      }
    } catch (err) {
      send("error", { message: String(err) });
    } finally {
      res.end();
    }
    return;
  }

  // ── PDF export ─────────────────────────────────────────────────────────────
  if (url.pathname === "/export-pdf" && req.method === "POST") {
    const body = await readBody(req);
    const { reportA, reportB, adA, adB } = JSON.parse(body);
    const pdf = generatePDF(adA, reportA, adB, reportB);
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=raport-sandbox.pdf",
      "Content-Length": pdf.length,
    });
    res.end(pdf);
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`\n◆ Synthetic Population Sandbox`);
  console.log(`  http://localhost:${PORT}\n`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("  ⚠ Brak ANTHROPIC_API_KEY");
  }
});
