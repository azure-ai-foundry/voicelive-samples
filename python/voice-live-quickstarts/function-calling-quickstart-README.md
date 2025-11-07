# Function Calling Quickstart

> **For common setup instructions, troubleshooting, and detailed information, see the [Python Samples README](../README.md)**

This sample demonstrates how to implement function calling with VoiceLive models, enabling the AI to execute custom Python functions during conversations. This is ideal for scenarios where the AI needs to perform actions, retrieve data, or integrate with external systems.

## What Makes This Sample Unique

This sample showcases:

- **Custom Function Definitions**: Define Python functions that the AI can call
- **Real-time Function Execution**: Execute functions during conversation
- **Function Result Handling**: Return results to the AI for natural responses
- **Advanced Tool Integration**: Demonstrate tool/function calling patterns
- **Flexible Authentication**: Supports both API key and Azure credential authentication

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
   python function-calling-quickstart.py
   ```

## Command Line Options

```bash
# Run with API key (from .env)
python function-calling-quickstart.py

# Run with Azure authentication
python function-calling-quickstart.py --use-entra-id

# Run with custom voice and verbose logging
python function-calling-quickstart.py --voice en-US-JennyNeural -v
```

### Available Options

- `--api-key`: Azure VoiceLive API key
- `--endpoint`: Azure VoiceLive endpoint URL
- `--model`: VoiceLive model to use (default: gpt-4o-realtime-preview)
- `--voice`: Voice for the assistant
- `--use-entra-id`: Use Azure authentication instead of API key
- `-v, --verbose`: Enable detailed logging

See [Python Samples README](../README.md) for available voices, troubleshooting, and additional resources.

## How It Works

The sample demonstrates:

1. **Function Definition**: Defines custom Python functions with type hints and descriptions
2. **Tool Registration**: Registers functions as tools that the AI can call
3. **Conversation Flow**: 
   - User speaks a request that requires function execution
   - AI recognizes the need and calls the appropriate function
   - Function executes and returns results
   - AI incorporates results into a natural response
4. **Real-time Processing**: All happens during the live conversation

### Example Functions

The sample includes example functions such as:
- **get_weather**: Retrieves weather information for a location
- **get_time**: Returns current time in different time zones
- **calculate**: Performs mathematical calculations

## Function Calling Pattern

```python
# 1. Define your function
def get_weather(location: str) -> dict:
    """Get weather for a location"""
    # Your implementation
    return {"temperature": 72, "condition": "sunny"}

# 2. Register as a tool
tools = [
    FunctionTool(
        name="get_weather",
        description="Get current weather",
        parameters={...},
        function=get_weather
    )
]

# 3. AI calls function during conversation
# 4. Function executes and returns results
# 5. AI uses results in response
```

## Additional Resources

- [Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)
- [Function Calling Guide](https://learn.microsoft.com/azure/ai-services/openai/how-to/function-calling)
- [Python SDK Documentation](https://learn.microsoft.com/en-us/python/api/overview/azure/ai-voicelive-readme)
- [Support Guide](../../SUPPORT.md)
