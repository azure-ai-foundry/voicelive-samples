# Agent Quickstart

> **For common setup instructions, troubleshooting, and detailed information, see the [C# Samples README](../README.md)**

This sample demonstrates how to build a real-time voice assistant that connects to an **Azure AI Foundry agent**. The agent manages model selection, instructions, and tools, enabling sophisticated conversational AI scenarios.

## What Makes This Sample Unique

This sample showcases:

- **Agent Integration**: Routes voice requests to a deployed Azure AI Foundry agent
- **Proactive Greeting**: Agent initiates the conversation with a welcome message
- **Agent Tools**: Leverages tools and functions configured in your agent
- **Azure Authentication Only**: Uses Azure credentials (API key auth not supported for agents)

## Prerequisites

- [Azure AI Foundry project](https://learn.microsoft.com/azure/ai-studio/how-to/create-projects) with a deployed agent
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) for authentication
- See [C# Samples README](../README.md) for common prerequisites

## Quick Start

1. **Authenticate with Azure**:
   ```powershell
   az login
   ```

2. **Update `appsettings.json`**:
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

3. **Run the sample**:
   ```powershell
   dotnet build
   dotnet run
   ```

## Command Line Options

```powershell
# Run with settings from appsettings.json
dotnet run

# Run with command line parameters
dotnet run --agent-id "asst_ABC123" --agent-project-name "my-project"

# Run with custom voice
dotnet run --voice "en-US-JennyNeural" --verbose
```

### Available Options

- `--endpoint`: Azure VoiceLive endpoint URL
- `--agent-id`: Azure AI Foundry agent ID (format: asst_xxxxx)
- `--agent-project-name`: Azure AI Foundry project name
- `--voice`: Voice for the assistant (default: "en-US-AvaNeural")
- `--verbose`: Enable detailed logging

See [C# Samples README](../README.md) for available voices, troubleshooting, and additional resources.
