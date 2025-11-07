# Agent Quickstart

> **For common setup instructions, troubleshooting, and detailed information, see the [Python Samples README](../README.md)**

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
- See [Python Samples README](../README.md) for common prerequisites

## Quick Start

1. **Authenticate with Azure**:
   ```bash
   az login
   ```

2. **Create and activate virtual environment**:
   ```bash
   python -m venv .venv
   
   # On Windows
   .venv\Scripts\activate
   
   # On Linux/macOS
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Update `.env` file**:
   ```plaintext
   AZURE_VOICELIVE_ENDPOINT=https://your-endpoint.services.ai.azure.com/
   AZURE_VOICELIVE_PROJECT_NAME=your-project-name
   AZURE_VOICELIVE_AGENT_ID=asst_your-agent-id
   AZURE_VOICELIVE_API_VERSION=2025-10-01
   ```

5. **Run the sample**:
   ```bash
   python agents-quickstart.py
   ```

## Command Line Options

```bash
# Run with settings from .env
python agents-quickstart.py

# Run with command line parameters
python agents-quickstart.py --agent-id asst_ABC123 --project-name my-project

# Run with custom voice and verbose logging
python agents-quickstart.py --voice en-US-JennyNeural -v
```

### Available Options

- `--endpoint`: Azure VoiceLive endpoint URL
- `--agent-id`: Azure AI Foundry agent ID (format: asst_xxxxx)
- `--project-name`: Azure AI Foundry project name
- `--voice`: Voice for the assistant
- `-v, --verbose`: Enable detailed logging

See [Python Samples README](../README.md) for available voices, troubleshooting, and additional resources.

## How It Works

The sample:

1. Authenticates using Azure credentials (`DefaultAzureCredential`)
2. Connects to your deployed Azure AI Foundry agent
3. Agent sends a proactive greeting to start the conversation
4. Captures audio from your microphone
5. Streams audio to the agent in real-time
6. Plays back agent responses through speakers
7. Handles interruptions and turn-taking naturally

## Additional Resources

- [Azure AI Foundry Documentation](https://learn.microsoft.com/azure/ai-studio/)
- [Python SDK Documentation](https://learn.microsoft.com/en-us/python/api/overview/azure/ai-voicelive-readme)
- [Support Guide](../../SUPPORT.md)
