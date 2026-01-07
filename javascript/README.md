# JavaScript/TypeScript Voice Assistant Samples

[Reference documentation](https://learn.microsoft.com/javascript/api/overview/azure/ai-voicelive-readme) | [Package (npm)](https://www.npmjs.com/package/@azure/ai-voicelive)

This folder contains JavaScript samples demonstrating how to build real-time voice assistants using Azure AI Speech VoiceLive service. Each sample is self-contained for easy understanding and deployment.

## Available Samples

### [Basic Web Voice Assistant](./basic-web-voice-assistant/)

A browser-based voice assistant demonstrating Azure Voice Live SDK integration in a web application using TypeScript and the Web Audio API.

**Key Features:**
- Client/Session architecture with type-safe handler-based events
- Real-time bi-directional audio streaming (PCM16)
- Live transcription and streaming text responses
- Barge-in support for natural conversation interruption
- Audio level visualization
- Support for OpenAI and Azure Neural voices

### [Voice Live Avatar](./voice-live-avatar/)

A Dockerized sample demonstrating Azure Voice Live API with avatar integration, enabling visual avatar representation during voice conversations.

**Key Features:**
- Avatar-enabled voice conversations
- Prebuilt and custom avatar character support
- Photo avatar option
- Proactive greeting support
- Barge-in support for natural conversation interruption
- Docker-based deployment
- Azure Container Apps deployment guide
- Developer mode for debugging

### [Voice Live Car Demo](./voice-live-car-demo/)

A React + Vite demo showcasing a Voice-Enabled Car Assistant powered by Azure OpenAI Realtime API.

**Live Demo:** [https://novaaidesigner.github.io/azure-voice-live-for-car/](https://novaaidesigner.github.io/azure-voice-live-for-car/)

**Key Features:**
- Vehicle Control (lights, windows, temp)
- Status Monitoring (speed, battery)
- Media & Navigation simulation
- Real-time EV driving cycle simulation
- Latency and token usage benchmarking

### [Voice Live Interpreter Demo](./voicelive-interpretator-demo/)

A minimal Vite + React + TypeScript demo that uses **Azure Voice Live** for real-time speech translation.

**Live Demo:** [https://novaaidesigner.github.io/azure-voice-live-interpreter/](https://novaaidesigner.github.io/azure-voice-live-interpreter/)

**Key Features:**
- Configurable `endpoint`, `apiKey`, `model` (defaults to `gpt-5`), and `target language`.
- “同声传译专家” system prompt (sentence-by-sentence, context-aware translation).
- Session window logs: ASR, translations, and event logs.
- Benchmarks per turn: latency + token usage (also keeps totals).
- One-click export to the **Azure Voice Live Calculator** via URL params.

### [Voice Live Trader Demo](./voice-live-trader-demo/)

A Web App based on Azure Speech Voice Live for real-time trading simulation.

**Live Demo:** [https://novaaidesigner.github.io/voice-live-trader/](https://novaaidesigner.github.io/voice-live-trader/)

**Key Features:**
- Real-time trading assistant
- Simulated matching engine (client-side)
- Usage statistics (tokens/audio/network)
- Multi-turn conversation support

## Prerequisites

All samples require:

- [Azure subscription](https://azure.microsoft.com/free/) - Create one for free
- [AI Foundry resource](https://learn.microsoft.com/azure/ai-services/multi-service-resource) with Voice Live enabled
- Modern browser (Chrome 66+, Firefox 60+, Safari 11.1+, Edge 79+)

**Sample-specific requirements:**

| Sample | Requirements |
|--------|--------------|
| Basic Web Voice Assistant | [Node.js 18+](https://nodejs.org/) with npm |
| Voice Live Avatar | [Docker](https://www.docker.com/get-started) |
| Voice Live Car Demo | [Node.js 18+](https://nodejs.org/) with npm |
| Voice Live Interpreter Demo | [Node.js 18+](https://nodejs.org/) with npm |
| Voice Live Trader Demo | [Node.js 18+](https://nodejs.org/) with npm |

## Getting Started

See individual sample READMEs for detailed setup instructions.

## Resources

- [Azure AI Speech - Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)
- [Support Guide](../SUPPORT.md)

## See Also

- [C# Samples](../csharp/README.md) - .NET implementation
- [Python Samples](../python/README.md) - Python implementation
- [Java Samples](../java/README.md) - Java implementation
