# Model Quickstart

> **For common setup instructions, troubleshooting, and detailed information, see the [Python Samples README](../README.md)**

This sample demonstrates how to build a real-time voice assistant using direct VoiceLive model integration. It provides a straightforward approach without agent overhead, ideal for scenarios where you want full control over model selection and instructions.

## What Makes This Sample Unique

This sample showcases:

- **Direct Model Access**: Connects directly to VoiceLive models (e.g., GPT-4o-realtime-preview)
- **Custom Instructions**: Define your own system instructions for the AI
- **Flexible Authentication**: Supports both API key and Azure credential authentication
- **Model Selection**: Choose from available VoiceLive models

## Prerequisites

- [AI Foundry resource](https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource)
- API key or [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) for authentication
- See [Python Samples README](../README.md) for common prerequisites

## Quick Start

1. **Create and activate virtual environment**:
   ```bash
   python -m venv .venv
   
   # On Windows
   .venv\Scripts\activate
   
   # On Linux/macOS
   source .venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Update `.env` file**:
   ```plaintext
   AZURE_VOICELIVE_ENDPOINT=https://your-endpoint.services.ai.azure.com/
   AZURE_VOICELIVE_API_KEY=your-api-key
   AZURE_VOICELIVE_API_VERSION=2025-10-01
   ```

4. **Run the sample**:
   ```bash
   python model-quickstart.py
   ```

## Command Line Options

```bash
# Run with API key (from .env)
python model-quickstart.py

# Run with Azure authentication
python model-quickstart.py --use-entra-id

# Run with custom model and instructions
python model-quickstart.py --model gpt-4o-realtime-preview --instructions "You are a helpful assistant"

# Run with custom voice and verbose logging
python model-quickstart.py --voice en-US-JennyNeural -v
```

### Available Options

- `--api-key`: Azure VoiceLive API key
- `--endpoint`: Azure VoiceLive endpoint URL
- `--model`: VoiceLive model to use (default: gpt-4o-realtime-preview)
- `--voice`: Voice for the assistant
- `--instructions`: Custom system instructions for the AI
- `--use-entra-id`: Use Azure authentication instead of API key
- `-v, --verbose`: Enable detailed logging

### Available Models

- `gpt-realtime` - Latest GPT-4o realtime model (recommended)
- `gpt-4.1` - GPT-4.1 LLM model

See [Python Samples README](../README.md) for available voices, troubleshooting, and additional resources.

## How It Works

The sample:

1. Authenticates using API key or Azure credentials
2. Connects directly to the VoiceLive model endpoint
3. Configures model with custom instructions (if provided)
4. Captures audio from your microphone
5. Streams audio to the model in real-time
6. Plays back model responses through speakers
7. Handles interruptions and turn-taking naturally

## Additional Resources

- [Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)
- [Python SDK Documentation](https://learn.microsoft.com/en-us/python/api/overview/azure/ai-voicelive-readme?view=azure-python)
- [Support Guide](../../SUPPORT.md)
