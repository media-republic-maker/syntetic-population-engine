# Synthetic Population Sandbox

Pre-testing platform for advertising campaigns on a synthetic, statistically calibrated Polish consumer population — before creatives reach real media.

## Problem

Traditional consumer research (focus groups, surveys) is expensive, slow, and susceptible to social bias (Hawthorne effect, social desirability). LLMs can simulate consumer reactions in real time — provided they represent a realistic population, not a homogeneous group of "average users."

## What it does

- **7,000 synthetic Poles** calibrated to official statistical data (GUS BDL 2024, NSP 2021, CBOS 2025)
- **Quick Study** — single-pass ad pre-test: N personas evaluated in parallel via LLM worker pool → aggregated report with attention score, purchase intent delta, WOM simulation, rejection signals
- **Simulation v2** — multi-round social simulation: GraphRAG knowledge extraction, per-round opinion evolution, agent memory, event injection, A/B testing, chat with agents
- **React frontend** — study management, real-time SSE streaming, recharts visualizations, PDF export

---

## Scientific Approach

### Population Synthesis

Instead of independent Monte Carlo sampling, we use **conditional marginal distributions with an explicit correlation matrix**, following the VAE/ABM specification (Espindola et al., 2022).

| Attribute | Source | Method |
|---|---|---|
| Age (5-year cohorts) | GUS BDL 2024, var. P2137 | Weighted random (8.7%–20.7%) |
| Gender | GUS 2024 | Bernoulli(p=0.52 female) |
| Education | GUS NSP 2021 | Conditional on age |
| Settlement type | GUS BDL 2024 | 5 classes: village 40.6% → metropolis 12% |
| Region | GUS BDL 2024 | 16 voivodeships, mazowieckie 15%, śląskie 11% |
| Income | GUS Household Budgets 2023 + BDL 216973 | Conditional on education × settlement × age |
| Political affiliation | CBOS BS/9/2025 | Conditional on age × settlement × education |
| Media habits | Gemius/PBI Megapanel Q3 2024 + Kantar 2024 | Probability sampling per platform, conditional on age × settlement |

### Structural Zeros

Logical consistency rules preventing impossible attribute combinations:

- Age 18–21 → `higher` education with probability < 3% (pre-graduation cohort)
- Age 18–24 → peak earnings impossible (labor market entry)
- Property ownership: `P(owns) = min(0.85, 0.20 + f(age, income))`

### OCEAN × Demographics Correlation Matrix

Big Five (Costa & McCrae, 1992) implemented with a full correlation matrix rather than independent sampling:

| Trait | Applied correlations |
|---|---|
| Openness | ↑ higher education (+12), ↑ metropolis (+6), ↑ age < 30 (+5), ↑ KO/Lewica (+5), ↓ PiS/Konfederacja (−5) |
| Conscientiousness | ↑ age > 50 (+8), ↑ higher education (+5), ↓ age < 25 (−5) |
| Extraversion | ↑ metropolis (+5), ↑ age < 30 (+3), ↑ female (+2), ↓ village (−4) |
| Agreeableness | ↑ female (+7), ↑ Lewica (+4), ↑ age > 50 (+3), ↓ Konfederacja (−8) |
| Neuroticism | ↑ female (+5), ↑ income < 2000 PLN (+8), ↑ age < 30 (+3), ↓ age > 50 (−4) |

### Psychographic Model

Each persona holds scales conditioned on demographics × political affiliation:

- **Traditionalism**: ↑ PiS/TD (+10), ↑ age > 55 (+15), ↓ higher education (−6)
- **Collectivism**: ↑ village (+6), ↑ age > 55 (+5), ↓ metropolis (−5) — Hofstede PL = 60/100
- **Institutional trust**: ↑ KO/TD (+8), ↓ Konfederacja (−15)
- **Media trust**: ↓ Konfederacja (−15), ↑ metropolis (−4 vs. local media)

### Information Diffusion (Bass Model)

Simulation v2 uses a diffusion mechanism modeled after Bass (1969):

- **Barabási–Albert graph** (preferential attachment) for the social network — realistic power-law degree distribution (hubs = influencers)
- **Hot score feed** — content prioritization by engagement (viral moment detection)
- **BeliefState** — agent conviction state evolves across rounds (no per-round reset)
- **Agent memory** — episodic memory with LLM compaction (no unbounded growth)

### 3-Tier LLM Router

Agents are routed to different LLM models based on their psychopolitical profile, preventing response homogenization:

| Segment | Model | Rationale |
|---|---|---|
| Center/Left (default) | Claude Sonnet | High-quality baseline |
| Moderate right (score > 15) | Llama 3.3 70B (Groq) | Different token distribution |
| Far right (score > 25 + extremism > 60) | Llama 4 Scout 17B (Groq) | Further distribution divergence |
| Far left (score < −25 + extremism > 60) | GPT-4o-mini (OpenAI) | Provider diversification |

---

## Architecture

```
src/
├── personas/
│   ├── generator.ts       # Population generation with correlated attributes
│   ├── distributions.ts   # 14 sampling functions (GUS/CBOS calibrated)
│   ├── schema.ts          # TypeScript strict: 6 profiles, ~35 attributes per persona
│   └── brandMemory.ts     # Prior brand awareness for ~100 Polish brands
├── engine/
│   ├── runner.ts          # LLM worker pool, SSE streaming
│   ├── modelRouter.ts     # 3-tier routing + rate limiting per provider
│   ├── prompt.ts          # System prompt builder (persona profile + ad context)
│   └── spread.ts          # WoM diffusion: seed selection, hop propagation, viral score
├── simulation/
│   ├── orchestrator.ts    # Full simulation lifecycle: init → rounds → complete
│   ├── roundEngine.ts     # Single round: agent selection, action generation, opinion update
│   ├── graphrag.ts        # Knowledge Graph extraction from creative via LLM
│   ├── agentMemory.ts     # Episodic memory with LLM compaction
│   ├── stateStore.ts      # In-memory store + JSON persistence
│   └── schema.ts          # Full TypeScript types for simulation
├── reports/
│   ├── aggregator.ts      # BotResponse → StudyReport (age/gender/location segmentation)
│   └── pdf.ts             # PDFKit report with charts, WOM quotes
└── server.ts              # Node.js http.createServer, REST + SSE, 15 endpoints

frontend/src/
├── app/
│   ├── pages/
│   │   ├── Dashboard.tsx        # Population stats, study history, KPIs
│   │   ├── NewStudy.tsx         # Study form → starts Simulation v2
│   │   ├── NewSimulation.tsx    # Simulation v2 form: creative, A/B, targeting, WoMM params
│   │   ├── SimulationView.tsx   # Real-time SSE stream, recharts, event injection, agent chat
│   │   ├── Simulations.tsx      # Simulation history
│   │   ├── Studies.tsx          # Study history
│   │   ├── Results.tsx          # Study results + PDF export
│   │   └── Population.tsx       # Population browser
│   └── utils/
│       └── api.ts               # Typed REST/SSE client, image compression to 60KB
```

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript strict |
| Frontend | React 19, Vite, React Router v7, Tailwind CSS, shadcn/ui, Recharts |
| LLM providers | Anthropic Claude Sonnet, OpenAI GPT-4o-mini, Groq (Llama 3.3 70B, Llama 4 Scout) |
| PDF | PDFKit |
| Persistence | JSON files (no database) |
| Infra | Docker Alpine, multi-stage build |

---

## Quick Start

### Prerequisites

- Docker
- API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`

### Run

```bash
# Create .env file
cat > .env << EOF
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
POPULATION_SIZE=7000
EOF

# Build and run
docker build -t swarm .
docker run -d --name swarm -p 3000:3000 --env-file .env swarm
```

Open `http://localhost:3000/adstest/`

### Rebuild

```bash
docker stop swarm && docker rm swarm
docker build -t swarm . && docker run -d --name swarm -p 3000:3000 --env-file .env swarm
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Claude Sonnet for center/left agents + GraphRAG + reports |
| `OPENAI_API_KEY` | — | Optional. GPT-4o-mini for far-left agents |
| `GROQ_API_KEY` | — | Optional. Llama models for right-wing agents |
| `POPULATION_SIZE` | `7000` | Number of synthetic personas to generate |
| `PORT` | `3000` | HTTP server port |

Without `OPENAI_API_KEY` / `GROQ_API_KEY`, all agents fall back to Claude Sonnet.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/population` | Population sample (first 100 personas) |
| `GET` | `/api/campaigns` | Study history |
| `GET` | `/api/simulations` | Simulation history |
| `POST` | `/api/simulation` | Start Simulation v2 |
| `GET` | `/api/simulation/:id/stream` | SSE stream for simulation rounds |
| `GET` | `/api/simulation/:id` | Simulation state |
| `POST` | `/api/simulation/:id/inject` | Inject runtime event |
| `POST` | `/api/simulation/:id/chat` | Chat with specific agent |
| `GET` | `/api/study` | Run Quick Study (SSE) |
| `POST` | `/api/upload-creative` | Upload KV creative (compressed to 60KB) |
| `POST` | `/api/summarize` | Generate executive summary via Claude |
| `POST` | `/api/export-pdf` | Generate PDF report |
| `GET` | `/api/results/:id` | Get study results |
| `GET` | `/api/brands` | Brand autocomplete list |

---

## Data Sources

- **GUS BDL 2024** — age cohorts (P2137), settlement types (60617/60633), regional population, household income (216973)
- **GUS NSP 2021** — education level distribution (full population)
- **GUS Household Budgets 2023** — income by household type
- **CBOS BS/9/2025** — political affiliation distributions
- **Gemius/PBI Megapanel Q3 2024** — platform reach by age/settlement
- **Kantar Media 2024** — TV consumption patterns
- **Costa & McCrae (1992)** — Big Five personality model
- **Bass (1969)** — information diffusion model
- **Espindola et al. (2022)** — VAE/ABM population synthesis specification
- **Hofstede (2010)** — Individualism/Collectivism index for Poland (IDV = 60)
