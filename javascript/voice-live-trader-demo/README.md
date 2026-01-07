# Voice Live Trader Agent

A Web App based on Azure Speech Voice Live:
- Connection Configuration (Voice Live WebSocket)
- Usage Statistics (tokens/audio/network bytes)
- Chat Window (Text + Optional Microphone Voice)
- Trading Form (Pure frontend simulated matching engine, client-side only)

**Live Demo:** [https://novaaidesigner.github.io/voice-live-trader/](https://novaaidesigner.github.io/voice-live-trader/)

## GitHub Pages Deployment

This project is configured for static export and publishing to GitHub Pages via GitHub Actions (see `.github/workflows/deploy.yml`).

This project is a pure frontend demo (no `/api/*` routes) and can be directly statically exported and deployed to Pages.

If you see an error in Actions like:
`Branch "master" is not allowed to deploy to github-pages due to environment protection rules.`
It means the repository has `github-pages` environment protection rules set (allowing only certain branches to deploy).
Two ways to resolve:
- In GitHub repository `Settings -> Environments -> github-pages`, add `master` to the allowed deployment branches; or
- Switch the default branch to `main` and adjust the workflow trigger branch accordingly.

## Run

```powershell
npm run dev
```

Open `http://localhost:3000` in your browser.

## Using Voice Live

Fill in the left side of the page:
- `Resource Host`: e.g., `<your-resource-name>.services.ai.azure.com` (or `...cognitiveservices.azure.com` for older resources)
- `API Version`: Default `2025-10-01`
- `Model`: Default `gpt-realtime`
- `API Key`

Then click "Connect". After successful connection:
- Enter trading requirements in Chat. The Agent will call the frontend simulated matching engine to place orders when needed and confirm with you in a neutral tone.
- Click "Enable Microphone" to send voice stream to Voice Live (PCM16 24kHz).

Note: Browser environments cannot set WebSocket Headers, so this project uses `api-key` as a URL query parameter for connection (via `wss://...&api-key=...`).

## Command Samples

You can try the following voice or text commands:

- **Place Order**: "Buy 100 shares of Microsoft at market price."
- **Update Draft**: "I want to sell Apple, limit price 150." (The agent will update the form without submitting)
- **Query Price**: "What's the current price of Bitcoin?"
- **Budget Order**: "Buy $1000 worth of Tesla." (The agent will calculate quantity based on current price)
- **Account Info**: "How much cash do I have left?"
- **Multi-turn**:
  - User: "Buy Google."
  - Agent: "Sure, how many shares?"
  - User: "10 shares."
  - Agent: "Market or Limit order?"
  - User: "Market."

## Trading Engine

This project includes a built-in frontend simulated matching engine (`src/lib/trade/engine.ts`). Account and order states exist only in client memory; refreshing the page will reset them.
