# C# Voice Assistant Samples

[SDK Reference documentation](https://learn.microsoft.com/dotnet/api/overview/azure/ai.voicelive-readme) | [Package (NuGet)](https://www.nuget.org/packages/Azure.AI.VoiceLive)

This folder contains C# samples demonstrating how to build real-time voice assistants using Azure AI Speech VoiceLive service. Each sample is self-contained with all code in a single `Program.cs` file for easy understanding and deployment.

## Available Samples

### [Agent Quickstart](./agent-quickstart/)
Demonstrates connecting to an Azure AI Foundry agent for voice conversations. The agent handles model selection, instructions, and tools, with support for proactive greetings.

**Key Features:**
- Azure AI Foundry agent integration
- Proactive greeting support
- Azure authentication (required)
- Agent-managed tools and instructions

### [Model Quickstart](./model-quickstart/)
Demonstrates direct integration with VoiceLive models for voice conversations without agent overhead.

**Key Features:**
- Direct model access
- Flexible authentication (API key or Azure credentials)
- Custom instructions support
- Model selection options

## Prerequisites

All samples require:

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) or later
- Audio input/output devices (microphone and speakers)
- [Azure subscription](https://azure.microsoft.com/free/) - Create one for free

### Azure Resources

Depending on which sample you want to run:

**For Agent Quickstart:**
- [Azure AI Foundry project](https://learn.microsoft.com/azure/ai-studio/how-to/create-projects) with a deployed agent
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) for authentication

**For Model Quickstart:**
- [AI Foundry resource](https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource)
- API key or [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) for authentication

## Getting Started

### Quick Start

1. **Choose a sample**: Navigate to either `agent-quickstart` or `model-quickstart` folder
2. **Install prerequisites**: Ensure .NET 8.0 SDK is installed
3. **Set up Azure resources**: Create required Azure resources based on the sample
4. **Configure settings**: Update `appsettings.json` with your Azure credentials
5. **Run the sample**:
   ```powershell
   cd <sample-folder>
   dotnet build
   dotnet run
   ```

### Authentication

**Agent Quickstart** requires Azure authentication:
```powershell
az login
dotnet run
```

**Model Quickstart** supports both methods:
```powershell
# With API key (from appsettings.json or --api-key)
dotnet run

# With Azure credentials
az login
dotnet run --use-token-credential
```

## Configuration

Each sample includes an `appsettings.json` file for configuration:

### Agent Quickstart Configuration
```json
{
  "VoiceLive": {
    "Endpoint": "https://your-endpoint.services.ai.azure.com/",
    "Voice": "en-US-AvaNeural"
  },
  "Agent": {
    "Id": "asst_your-agent-id",
    "ProjectName": "your-project-name"
  }
}
```

### Model Quickstart Configuration
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

## Common Features

All samples demonstrate:

- **Real-time Voice**: Bidirectional audio streaming for natural conversations
- **Audio Processing**: Microphone capture and speaker playback using NAudio
- **Interruption Handling**: Support for natural turn-taking in conversations
- **Resource Management**: Proper cleanup of connections and audio resources
- **Self-contained Code**: All logic in a single Program.cs file

## Available Voices

Popular neural voice options include:

- `en-US-AvaNeural` - Female, conversational
- `en-US-AndrewNeural` - Male, conversational
- `en-US-JennyNeural` - Female, friendly
- `en-US-GuyNeural` - Male, professional
- `en-US-AriaNeural` - Female, cheerful
- `en-US-DavisNeural` - Male, calm

See the [Azure Neural Voice Gallery](https://speech.microsoft.com/portal/voicegallery) for all available voices.

## Architecture

### Agent Quickstart Flow
```
User Voice → Microphone → AudioProcessor → VoiceLive SDK → Azure AI Foundry Agent
                                                                      ↓
User Hears ← Speakers ← AudioProcessor ← VoiceLive SDK ← Agent Response
```

### Model Quickstart Flow
```
User Voice → Microphone → AudioProcessor → VoiceLive SDK → Azure AI Model (GPT-4o)
                                                                      ↓
User Hears ← Speakers ← AudioProcessor ← VoiceLive SDK ← Model Response
```

## Troubleshooting

### Audio Issues

- **No audio input/output**: Verify your microphone and speakers are working and set as default devices in Windows settings
- **Audio device busy**: Close other applications using your audio devices (e.g., Teams, Zoom)
- **Poor audio quality**: Update your audio drivers to the latest version
- **NAudio errors**: Run `dotnet restore` to ensure NAudio package is properly installed

### Authentication Issues

- **401 Unauthorized**: 
  - For API key: Verify your API key in appsettings.json or environment variables
  - For Azure auth: Run `az login` to authenticate with Azure CLI
- **Agent not found** (Agent sample): Check your agent ID format (should be `asst_xxxxx`) and project name
- **Token credential fails**: Ensure Azure CLI is installed and you're logged in
- **Insufficient permissions** (Agent sample): Verify your Azure account has access to the AI Foundry project

### Connection Issues

- **Endpoint errors**: Verify your endpoint URL format: `https://your-endpoint.services.ai.azure.com/`
- **WebSocket timeout**: Check your network connection and firewall settings
- **Certificate errors**: Ensure your system certificates are up to date
- **Model not available** (Model sample): Verify your Speech resource has VoiceLive enabled

### Build Issues

- **Missing packages**: Run `dotnet restore` to restore NuGet packages
- **SDK version**: Verify .NET 8.0 SDK or later is installed: `dotnet --version`
- **Build errors**: Try `dotnet clean` followed by `dotnet restore` and `dotnet build`

### Common Command Line Options

Both samples support these options:

- `--endpoint`: Azure VoiceLive endpoint URL
- `--voice`: Voice for the assistant (default: "en-US-AvaNeural")
- `--verbose`: Enable detailed logging

**Agent-specific options:**
- `--agent-id`: Azure AI Foundry agent ID
- `--agent-project-name`: Azure AI Foundry project name

**Model-specific options:**
- `--api-key`: Azure VoiceLive API key
- `--model`: VoiceLive model to use
- `--instructions`: Custom system instructions
- `--use-token-credential`: Use Azure authentication

## Additional Resources

- [Azure AI Speech - Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)
- [.NET SDK Documentation](https://learn.microsoft.com/dotnet/api/overview/azure/ai.voicelive-readme)
- [Support Guide](../SUPPORT.md)

## Contributing

We welcome contributions! Please see the [Support Guide](../SUPPORT.md#contributing) for details on how to contribute.

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
