# Model Quickstart

> **For common setup instructions, troubleshooting, and detailed information, see the [C# Samples README](../README.md)**

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
- See [C# Samples README](../README.md) for common prerequisites

## Quick Start

1. **Update `appsettings.json`**:
   ```json
   {
     "VoiceLive": {
       "ApiKey": "your-voicelive-api-key",
       "Endpoint": "https://your-endpoint.services.ai.azure.com/",
       "Model": "gpt-4o-realtime-preview",
       "Voice": "en-US-AvaNeural"
     }
   }
   ```

2. **Run the sample**:
   ```powershell
   dotnet build
   dotnet run
   ```

## Command Line Options

```powershell
# Run with API key (from appsettings.json)
dotnet run

# Run with Azure authentication
dotnet run --use-token-credential

# Run with custom model and instructions
dotnet run --model "gpt-4o-realtime-preview" --instructions "You are a helpful assistant"

# Run with custom voice and verbose logging
dotnet run --voice "en-US-JennyNeural" --verbose
```

### Available Options

- `--api-key`: Azure VoiceLive API key
- `--endpoint`: Azure VoiceLive endpoint URL
- `--model`: VoiceLive model to use (default: "gpt-4o-realtime-preview")
- `--voice`: Voice for the assistant (default: "en-US-AvaNeural")
- `--instructions`: Custom system instructions for the AI
- `--use-token-credential`: Use Azure authentication instead of API key
- `--verbose`: Enable detailed logging

### Available Models

- `gpt-realtime` - Latest GPT-realtime model (recommended)
- `gpt-4.1` - GPT-4.1 LLM model
- See documentation for all available models

See [C# Samples README](../README.md) for available voices, troubleshooting, and additional resources.
