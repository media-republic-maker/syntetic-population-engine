// ─────────────────────────────────────────────────────────────────────────────
// Prosty serwer HTTP – formularz + SSE streaming postępu
// tsx src/server.ts  →  http://localhost:3000
// ─────────────────────────────────────────────────────────────────────────────

import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generatePopulation } from "./personas/generator.js";
import { runStudy } from "./engine/runner.js";
import { aggregateResults } from "./reports/aggregator.js";
import type { AdMaterial, Persona } from "./personas/schema.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const DATA_DIR = join(process.cwd(), "data");
const POPULATION_PATH = join(DATA_DIR, "population.json");
const RESULTS_DIR = join(DATA_DIR, "results");

// ─────────────────────────────────────────────────────────────────────────────
// Populacja (singleton per instancja serwera)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Odczyt body POST
// ─────────────────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML
// ─────────────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Synthetic Population Sandbox</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f0f11;
      color: #e4e4e7;
      min-height: 100vh;
      padding: 2rem;
    }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.25rem; }
    .subtitle { color: #71717a; font-size: 0.875rem; margin-bottom: 2rem; }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    label { display: block; font-size: 0.8rem; color: #a1a1aa; margin-bottom: 0.4rem; }
    input, textarea, select {
      width: 100%;
      background: #09090b;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      color: #e4e4e7;
      padding: 0.6rem 0.75rem;
      font-size: 0.9rem;
      margin-bottom: 1rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus, textarea:focus, select:focus { border-color: #6366f1; }
    textarea { resize: vertical; min-height: 90px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    button {
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 0.7rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }
    button:hover { background: #4f46e5; }
    button:disabled { background: #3f3f46; cursor: not-allowed; }
    #progress {
      display: none;
      margin-top: 1.5rem;
    }
    .progress-bar-wrap {
      background: #27272a;
      border-radius: 99px;
      height: 6px;
      margin: 0.75rem 0;
      overflow: hidden;
    }
    .progress-bar {
      background: #6366f1;
      height: 100%;
      border-radius: 99px;
      width: 0%;
      transition: width 0.3s;
    }
    .progress-label { font-size: 0.8rem; color: #71717a; }
    #results { display: none; margin-top: 1.5rem; }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .metric {
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 1rem;
      text-align: center;
    }
    .metric-value { font-size: 2rem; font-weight: 700; color: #6366f1; }
    .metric-label { font-size: 0.75rem; color: #71717a; margin-top: 0.25rem; }
    .segment-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .segment-table th { text-align: left; color: #71717a; padding: 0.5rem 0.75rem; border-bottom: 1px solid #27272a; }
    .segment-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #18181b; }
    .tag { display: inline-block; background: #27272a; border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.75rem; margin: 0.2rem; }
    .section-title { font-size: 0.8rem; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; margin-top: 1.25rem; }
    .positive { color: #22c55e; }
    .negative { color: #ef4444; }
    .neutral { color: #a1a1aa; }
    #log { font-size: 0.8rem; color: #71717a; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Synthetic Population Sandbox</h1>
  <p class="subtitle">Pre-test komunikacji reklamowej na syntetycznej populacji polskich konsumentów</p>

  <div class="card">
    <form id="studyForm">
      <label>Headline *</label>
      <input type="text" name="headline" required placeholder="Główny nagłówek reklamy">

      <label>Body (treść) *</label>
      <textarea name="body" required placeholder="Tekst reklamy..."></textarea>

      <label>CTA *</label>
      <input type="text" name="cta" required placeholder="Tekst przycisku / wezwanie do działania">

      <div class="row">
        <div>
          <label>Nazwa marki</label>
          <input type="text" name="brandName" placeholder="np. Nike, mBank...">
        </div>
        <div>
          <label>Kategoria produktu</label>
          <select name="productCategory">
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
            <option value="home_appliances">AGD/RTV</option>
          </select>
        </div>
      </div>

      <label>Kontekst ekspozycji (opcjonalnie)</label>
      <input type="text" name="context" placeholder="np. Reklama podczas scrollowania Instagram Stories">

      <button type="submit" id="submitBtn">Uruchom badanie</button>
    </form>
  </div>

  <div id="progress">
    <div class="card">
      <div class="progress-label" id="progressLabel">Inicjalizacja...</div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" id="progressBar"></div>
      </div>
      <div id="log"></div>
    </div>
  </div>

  <div id="results">
    <div class="card">
      <div class="section-title">Wyniki agregat</div>
      <div class="metric-grid">
        <div class="metric">
          <div class="metric-value" id="mAttention">–</div>
          <div class="metric-label">Attention Score / 10</div>
        </div>
        <div class="metric">
          <div class="metric-value" id="mResonance">–</div>
          <div class="metric-label">Resonance Score / 10</div>
        </div>
        <div class="metric">
          <div class="metric-value" id="mPurchase">–</div>
          <div class="metric-label">Purchase Intent Δ</div>
        </div>
        <div class="metric">
          <div class="metric-value" id="mTrust">–</div>
          <div class="metric-label">Trust Impact Δ</div>
        </div>
      </div>

      <div class="section-title">Segmentacja wiekowa</div>
      <table class="segment-table" id="ageTable">
        <thead><tr><th>Wiek</th><th>n</th><th>Attention</th><th>Resonance</th><th>Purchase Δ</th><th>Trust Δ</th></tr></thead>
        <tbody></tbody>
      </table>

      <div class="section-title">Segmentacja płci</div>
      <table class="segment-table" id="genderTable">
        <thead><tr><th>Płeć</th><th>n</th><th>Attention</th><th>Resonance</th><th>Purchase Δ</th><th>Trust Δ</th></tr></thead>
        <tbody></tbody>
      </table>

      <div class="section-title">Co zapamiętali (top recall)</div>
      <div id="recallList"></div>

      <div class="section-title">Co powiedzieliby znajomemu (WOM)</div>
      <div id="womList"></div>

      <div class="section-title">Sygnały odrzucenia</div>
      <div id="rejectionList"></div>
    </div>
  </div>

  <script>
    const form = document.getElementById('studyForm');
    const submitBtn = document.getElementById('submitBtn');
    const progress = document.getElementById('progress');
    const results = document.getElementById('results');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      submitBtn.disabled = true;
      progress.style.display = 'block';
      results.style.display = 'none';
      document.getElementById('log').textContent = '';
      setProgress(0, 'Uruchamianie badania...');

      const es = new EventSource('/study?' + new URLSearchParams({
        headline: data.headline,
        body: data.body,
        cta: data.cta,
        brandName: data.brandName || '',
        productCategory: data.productCategory || '',
        context: data.context || '',
      }));

      es.addEventListener('progress', (e) => {
        const { done, total } = JSON.parse(e.data);
        setProgress(done / total * 100, \`Postęp: \${done}/\${total} botów\`);
      });

      es.addEventListener('result', (e) => {
        es.close();
        submitBtn.disabled = false;
        const report = JSON.parse(e.data);
        renderResults(report);
        setProgress(100, 'Badanie zakończone');
      });

      es.addEventListener('error', (e) => {
        es.close();
        submitBtn.disabled = false;
        document.getElementById('log').textContent = 'Błąd: ' + (e.data ?? 'nieznany błąd');
      });
    });

    function setProgress(pct, label) {
      document.getElementById('progressBar').style.width = pct + '%';
      document.getElementById('progressLabel').textContent = label;
    }

    function colorDelta(val) {
      if (val > 0) return \`<span class="positive">+\${val}</span>\`;
      if (val < 0) return \`<span class="negative">\${val}</span>\`;
      return \`<span class="neutral">0</span>\`;
    }

    function renderResults(report) {
      results.style.display = 'block';
      const a = report.aggregate;
      document.getElementById('mAttention').textContent = a.attentionScore;
      document.getElementById('mResonance').textContent = a.resonanceScore;
      document.getElementById('mPurchase').innerHTML = colorDelta(a.purchaseIntentDelta);
      document.getElementById('mTrust').innerHTML = colorDelta(a.trustImpact);

      fillTable('ageTable', report.byAgeGroup);
      fillTable('genderTable', report.byGender);

      document.getElementById('recallList').innerHTML =
        report.topRecalls.map(r => \`<span class="tag">\${r}</span>\`).join('');
      document.getElementById('womList').innerHTML =
        report.topWom.map(r => \`<div style="margin-bottom:.5rem;font-size:.875rem;">„\${r}"</div>\`).join('');
      document.getElementById('rejectionList').innerHTML =
        report.allRejections.map(r => \`<span class="tag" style="color:#ef4444">\${r}</span>\`).join('');
    }

    function fillTable(id, segments) {
      const tbody = document.querySelector('#' + id + ' tbody');
      tbody.innerHTML = Object.values(segments).map(s => \`<tr>
        <td>\${s.label}</td>
        <td>\${s.count}</td>
        <td>\${s.attentionScore}</td>
        <td>\${s.resonanceScore}</td>
        <td>\${colorDelta(s.purchaseIntentDelta)}</td>
        <td>\${colorDelta(s.trustImpact)}</td>
      </tr>\`).join('');
    }
  </script>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
    return;
  }

  // SSE endpoint – streaming postępu badania
  if (url.pathname === "/study" && req.method === "GET") {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Brak ANTHROPIC_API_KEY" }));
      return;
    }

    const ad: AdMaterial = {
      headline: url.searchParams.get("headline") ?? "",
      body: url.searchParams.get("body") ?? "",
      cta: url.searchParams.get("cta") ?? "",
      brandName: url.searchParams.get("brandName") ?? undefined,
      productCategory: (url.searchParams.get("productCategory") ?? undefined) as AdMaterial["productCategory"],
      context: url.searchParams.get("context") ?? undefined,
    };

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const population = getPopulation();
      const responses = await runStudy(population, ad, (done, total) => {
        send("progress", { done, total });
      });
      const report = aggregateResults(population, responses);

      // Zapis
      mkdirSync(RESULTS_DIR, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      writeFileSync(
        join(RESULTS_DIR, `report_${ts}.json`),
        JSON.stringify({ ad, report, responses }, null, 2),
        "utf8"
      );

      send("result", report);
    } catch (err) {
      send("error", { message: String(err) });
    } finally {
      res.end();
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n◆ Synthetic Population Sandbox`);
  console.log(`  http://localhost:${PORT}\n`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("  ⚠ Brak ANTHROPIC_API_KEY – badania nie będą działać");
  }
});
