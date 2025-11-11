# Model Quickstart

> **For common setup instructions, troubleshooting, and detailed information, see the [Java Samples README](../../README.md)**

This sample demonstrates how to build a real-time voice assistant using direct VoiceLive model integration. It provides a straightforward approach without agent overhead, ideal for scenarios where you want full control over model selection and instructions.

## What Makes This Sample Unique

This sample showcases:

- **Direct Model Access**: Connects directly to VoiceLive models (e.g., gpt-realtime)
- **Custom Instructions**: Define your own system instructions for the AI
- **Flexible Authentication**: Supports both API key and Azure credential authentication
- **Model Selection**: Choose from available VoiceLive models
- **Audio Processing**: Real-time microphone capture and speaker playback
- **Voice Activity Detection**: Interrupt handling and turn detection

## Prerequisites

- [Java 11](https://www.oracle.com/java/technologies/javase/jdk11-archive-downloads.html) or later
- [Maven 3.6+](https://maven.apache.org/download.cgi)
- [AI Foundry resource](https://learn.microsoft.com/azure/ai-services/multi-service-resource)
- API key or [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) for authentication
- Audio input/output devices (microphone and speakers)
- See [Java Samples README](../../README.md) for common prerequisites

## Quick Start

1. **Update `application.properties`**:

   Copy `application.properties.sample` to `application.properties` and fill in your values:

   ```properties
   # Required: Your VoiceLive endpoint URL
   azure.voicelive.endpoint=https://your-endpoint.services.ai.azure.com/

   # Required: Your API key (if using API key authentication)
   azure.voicelive.api-key=your-api-key-here

   # Optional: Model name (default: gpt-realtime)
   # azure.voicelive.model=gpt-realtime

   # Optional: Voice name (default: en-US-Ava:DragonHDLatestNeural)
   # azure.voicelive.voice=en-US-Ava:DragonHDLatestNeural
   ```

2. **Build the project**:

   ```bash
   mvn clean install
   ```

3. **Run the sample**:

   ```bash
   # Run with API key (from application.properties)
   mvn exec:java

   # Run with Azure authentication
   mvn exec:java -Dexec.args="--use-token-credential"
   ```

## Command Line Options

```bash
# Run with API key (from application.properties)
mvn exec:java

# Run with Azure authentication
mvn exec:java -Dexec.args="--use-token-credential"

# Run with custom model
mvn exec:java -Dexec.args="--model gpt-realtime"

# Run with custom voice
mvn exec:java -Dexec.args="--voice en-US-Jenny:DragonHDLatestNeural"

# Run with custom instructions
mvn exec:java -Dexec.args="--instructions 'You are a helpful assistant'"

# Run with verbose logging
mvn exec:java -Dexec.args="--verbose"

# Combine multiple options
mvn exec:java -Dexec.args="--use-token-credential --verbose --model gpt-realtime"
```

### Available Options

- `--api-key`: Azure VoiceLive API key (overrides application.properties)
- `--endpoint`: Azure VoiceLive endpoint URL (overrides application.properties)
- `--model`: VoiceLive model to use (default: "gpt-realtime")
- `--voice`: Voice for the assistant (default: "en-US-Ava:DragonHDLatestNeural")
- `--instructions`: Custom system instructions for the AI
- `--use-token-credential`: Use Azure authentication instead of API key
- `--verbose`: Enable detailed logging

### Available Models

- `gpt-realtime` - Latest GPT-realtime model (recommended)
- See documentation for all available models

## How It Works

This sample demonstrates a complete real-time voice assistant with:

1. **Audio Capture**: Continuously captures audio from your microphone at 24kHz, 16-bit PCM mono format
2. **Streaming**: Sends audio data to the VoiceLive service in real-time
3. **Processing**: The service processes your speech and generates responses
4. **Playback**: Receives and plays audio responses through your speakers
5. **Interruption**: Supports natural conversation flow where you can interrupt the assistant

### Key Components

- **VoiceLiveSessionAsyncClient**: Manages the WebSocket connection to the service
- **AudioProcessor**: Handles microphone capture and speaker playback
- **Voice Activity Detection**: Detects when you start and stop speaking
- **Audio Transcription**: Optional Whisper-based transcription of your speech
- **Noise Reduction**: Echo cancellation and noise reduction for better audio quality

## Configuration Details

### Authentication Methods

**API Key Authentication** (default):

```properties
azure.voicelive.api-key=your-api-key-here
```

**Azure Credential Authentication**:

```bash
az login
mvn exec:java -Dexec.args="--use-token-credential"
```

### Audio Configuration

The sample uses the following audio settings as required by VoiceLive:

- **Sample Rate**: 24,000 Hz (24kHz)
- **Bit Depth**: 16-bit PCM
- **Channels**: Mono (1 channel)
- **Encoding**: Signed PCM, little-endian

### Voice Options

Available voices include:

- `en-US-Ava:DragonHDLatestNeural` (default)
- `en-US-Jenny:DragonHDLatestNeural`
- `en-US-Guy:DragonHDLatestNeural`
- See the [Java Samples README](../../README.md) for a complete list of available voices

## Troubleshooting

### Common Issues

**Microphone not found**:

- Ensure your microphone is connected and properly configured
- Check system audio settings and permissions
- Try running the sample with administrator privileges

**Authentication errors**:

- Verify your API key or Azure credentials are correct
- Ensure your endpoint URL is properly formatted
- Check that your Azure subscription is active

**Audio quality issues**:

- Ensure you're using a quality microphone
- Enable noise reduction and echo cancellation
- Check for proper audio device configuration

**Connection errors**:

- Verify network connectivity
- Check firewall and proxy settings
- Ensure the endpoint URL is accessible

For more troubleshooting guidance, see the [Java Samples README](../../README.md).

## Additional Resources

- [Azure AI Speech - Voice Live Documentation](https://learn.microsoft.com/azure/ai-services/speech-service/voice-live)
- [VoiceLive SDK Documentation](https://learn.microsoft.com/java/api/overview/azure/ai-voicelive-readme)
- [Azure AI Services Documentation](https://learn.microsoft.com/azure/ai-services/)
- [Support Guide](../../../SUPPORT.md)

## Code Structure

```text
ModelQuickstart/
├── ModelQuickstart.java       # Main application with all logic
├── pom.xml                    # Maven project configuration
├── application.properties     # Your configuration (create from sample)
├── application.properties.sample  # Sample configuration template
└── README.md                  # This file
```

## Next Steps

- Explore the [Agent Quickstart](../AgentQuickstart/) sample for agent-based conversations
- Learn about function calling and custom tools
- Customize the system instructions for your use case
- Integrate with your own applications and services

## Contributing

Interested in contributing? Please see our [Contributing Guidelines](../../../SUPPORT.md#contributing).
