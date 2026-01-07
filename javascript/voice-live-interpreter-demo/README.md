# Azure Voice Live - Speech Translation (Web Demo)

This is a Javascript (React + Vite) demo for the Azure Voice Live (Realtime API) in a Speech Translation scenario.

**Live Demo:** [https://novaaidesigner.github.io/azure-voice-live-interpreter/](https://novaaidesigner.github.io/azure-voice-live-interpreter/)

A minimal Vite + React + TypeScript demo that uses **Azure Voice Live** for real-time speech translation.

Features:
- Configurable `endpoint`, `apiKey`, `model` (defaults to `gpt-5`), and `target language`.
- “Interpreter” system prompt (sentence-by-sentence, context-aware translation).
- Session window logs: ASR, translations, and event logs.
- Benchmarks per turn: latency + token usage (also keeps totals).
- One-click export to the **Azure Voice Live Calculator** via URL params.

## Run

```powershell
npm install
npm run dev
```

Open the printed local URL, set your Voice Live `endpoint` + `apiKey`, then click **Connect**.

## Notes

- Browser audio requires a user gesture; use **Connect** / **Start Mic** buttons.
- The config is stored in `localStorage` in your browser.
