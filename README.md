# Bridgelingua

**Open-source web platform for multilingual speech recognition across 1,600+ languages.**

Transcribe, translate, and archive endangered language audio with AI. Built for field linguists & language preservation communities. A [UNESCO IDIL 2022-2032](https://idil2022-2032.org) registered initiative.

---

## What is Bridgelingua?

Over 40% of the world's 7,000+ languages are endangered — most have never been written down. Recent AI breakthroughs (Meta's OmniASR/MMS) now support ASR for 1,600+ languages, but these models remain locked in research environments inaccessible to the people who need them most.

**Bridgelingua bridges this gap.** We provide field linguists, indigenous communities, and language preservation practitioners with an accessible web platform to document, transcribe, translate, and archive any language — no coding required.

## Features

- **1,600+ Language ASR** — Automatic speech recognition powered by Meta OmniASR/MMS, covering more languages than any commercial service
- **Bilingual Translation** — Neural machine translation (NLLB) pipeline connecting indigenous languages to global languages
- **Multi-format Export** — JSON, CSV, SRT, TXT, with ELAN XML support planned
- **Community Fine-tuning** *(P2)* — Upload labeled speech data to fine-tune ASR models for your language via LoRA
- **Ethical Data Governance** — Built with [CARE Principles](https://www.gida-global.org/care) for Indigenous Data Governance
- **i18n Interface** — Full Chinese/English bilingual UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Zustand |
| Backend | Python 3.10+ / FastAPI + SQLAlchemy (async) |
| ASR Model | Meta OmniASR (Wav2Vec2 + LLM, 1,600+ languages) |
| Translation | Meta NLLB-200 (200 languages) |
| Database | SQLite (async via aiosqlite) |
| Deployment | Nginx + systemd (Linux) |

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- GPU with CUDA 11.8+ *(optional — runs in Mock mode without GPU)*

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .           # Mock mode (no GPU needed)
# pip install -e ".[ml]"   # Full inference mode (requires GPU)
uvicorn app.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

> **Mock Mode**: Without `omniasr` and `transformers` installed, the system automatically returns simulated transcriptions — ideal for frontend development and UI testing.

## Project Structure

```
bridgelingua/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entrypoint
│   │   ├── config.py        # Environment configuration
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routers/         # API routes (transcribe, languages, library, lexicon)
│   │   ├── services/        # ASR & translation service layer
│   │   └── storage/         # Runtime data (db + uploads)
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/      # React components (workspace, library, lexicon, settings)
│   │   ├── stores/          # Zustand state management
│   │   ├── hooks/           # Custom hooks (useApi, useAudioRecorder, useTheme)
│   │   ├── i18n/            # Internationalization (en/zh)
│   │   └── utils/           # Export utilities
│   └── package.json
├── deploy/                  # Nginx & systemd configs
└── docs/                    # API specifications
```

## Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|-------------|
| **P1 — MVP** | Week 1 | Web ASR transcription + bilingual translation + multi-format export + archiving |
| **P2 — Core** | Week 2-4 | Community-driven fine-tuning SOP (LoRA) + collaborative proofreading + data flywheel |
| **P3 — Expand** | Month 2+ | Zero-shot new language expansion + TTS + open API |

## Contributing

We welcome contributions from linguists, developers, and language communities. Please open an issue or submit a pull request.

## License

[MIT License](LICENSE)

## Acknowledgments

- [Meta FAIR](https://ai.meta.com/) — OmniASR / MMS / NLLB open-source models
- [UNESCO IDIL 2022-2032](https://idil2022-2032.org) — International Decade of Indigenous Languages
- [CARE Principles](https://www.gida-global.org/care) — Indigenous Data Governance framework
