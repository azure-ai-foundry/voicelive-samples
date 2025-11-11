// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import com.azure.ai.voicelive.VoiceLiveAsyncClient;
import com.azure.ai.voicelive.VoiceLiveClientBuilder;
import com.azure.ai.voicelive.VoiceLiveServiceVersion;
import com.azure.ai.voicelive.VoiceLiveSessionAsyncClient;
import com.azure.ai.voicelive.models.AudioEchoCancellation;
import com.azure.ai.voicelive.models.AudioInputTranscriptionOptions;
import com.azure.ai.voicelive.models.AudioInputTranscriptionOptionsModel;
import com.azure.ai.voicelive.models.AudioNoiseReduction;
import com.azure.ai.voicelive.models.AudioNoiseReductionType;
import com.azure.ai.voicelive.models.ClientEventSessionUpdate;
import com.azure.ai.voicelive.models.InputAudioFormat;
import com.azure.ai.voicelive.models.InteractionModality;
import com.azure.ai.voicelive.models.AzureStandardVoice;
import com.azure.ai.voicelive.models.OutputAudioFormat;
import com.azure.ai.voicelive.models.ServerEventType;
import com.azure.ai.voicelive.models.ServerVadTurnDetection;
import com.azure.ai.voicelive.models.SessionUpdate;
import com.azure.ai.voicelive.models.SessionUpdateError;
import com.azure.ai.voicelive.models.SessionUpdateResponseAudioDelta;
import com.azure.ai.voicelive.models.SessionUpdateSessionUpdated;
import com.azure.ai.voicelive.models.VoiceLiveSessionOptions;
import com.azure.core.credential.KeyCredential;
import com.azure.core.credential.TokenCredential;
import com.azure.core.util.BinaryData;
import com.azure.identity.AzureCliCredentialBuilder;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.LineUnavailableException;
import javax.sound.sampled.SourceDataLine;
import javax.sound.sampled.TargetDataLine;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Properties;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Complete voice assistant sample demonstrating full-featured real-time voice conversation.
 *
 * <p><strong>NOTE:</strong> This is a comprehensive sample showing all features together.
 * For easier understanding, see these focused samples:</p>
 * <ul>
 *   <li>{@link BasicVoiceConversationSample} - Minimal setup and session management</li>
 *   <li>{@link MicrophoneInputSample} - Audio capture from microphone</li>
 *   <li>{@link AudioPlaybackSample} - Audio playback to speakers</li>
 *   <li>{@link AuthenticationMethodsSample} - Different authentication methods</li>
 * </ul>
 *
 * <p>This sample demonstrates:</p>
 * <ul>
 *   <li>Real-time microphone audio capture</li>
 *   <li>Streaming audio to VoiceLive service</li>
 *   <li>Receiving and playing audio responses</li>
 *   <li>Voice Activity Detection (VAD) with interruption handling</li>
 *   <li>Multi-threaded audio processing</li>
 *   <li>Audio transcription with Whisper</li>
 *   <li>Noise reduction and echo cancellation</li>
 *   <li>Dual authentication support (API key and token credential)</li>
 * </ul>
 *
 * <p><strong>Environment Variables Required:</strong></p>
 * <ul>
 *   <li>AZURE_VOICELIVE_ENDPOINT - The VoiceLive service endpoint URL</li>
 *   <li>AZURE_VOICELIVE_API_KEY - The API key (required if not using --use-token-credential)</li>
 * </ul>
 *
 * <p><strong>Audio Requirements:</strong></p>
 * The sample requires a working microphone and speakers/headphones.
 * Audio format is 24kHz, 16-bit PCM, mono as required by the VoiceLive service.
 *
 * <p><strong>How to Run:</strong></p>
 * <pre>{@code
 * # With API Key (default):
 * mvn exec:java -Dexec.mainClass="com.azure.ai.voicelive.VoiceAssistantSample" -Dexec.classpathScope=test
 *
 * # With Token Credential:
 * mvn exec:java -Dexec.mainClass="ModelQuickstart" -Dexec.classpathScope=test -Dexec.args="--use-token-credential"
 * }</pre>
 */
public final class ModelQuickstart {

    // Service configuration constants
    private static final String DEFAULT_API_VERSION = "2025-10-01";
    private static final String DEFAULT_MODEL = "gpt-realtime";
    private static final String DEFAULT_VOICE = "en-US-Ava:DragonHDLatestNeural";
    private static final String DEFAULT_INSTRUCTIONS = "You are a helpful AI voice assistant. Respond naturally and conversationally. Keep your responses concise but engaging. Speak as if having a real conversation.";

    // Environment variable names
    private static final String ENV_ENDPOINT = "AZURE_VOICELIVE_ENDPOINT";
    private static final String ENV_API_KEY = "AZURE_VOICELIVE_API_KEY";

    // Audio format constants (VoiceLive requirements)
    private static final int SAMPLE_RATE = 24000;          // 24kHz as required by VoiceLive
    private static final int CHANNELS = 1;                 // Mono
    private static final int SAMPLE_SIZE_BITS = 16;        // 16-bit PCM
    private static final int CHUNK_SIZE = 1200;            // 50ms chunks (24000 * 0.05)
    private static final int AUDIO_BUFFER_SIZE_MULTIPLIER = 4;

    // Private constructor to prevent instantiation
    private ModelQuickstart() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    /**
     * Audio packet for playback queue management.
     * Uses sequence numbers to support interruption handling.
     */
    private static class AudioPlaybackPacket {
        final int sequenceNumber;
        final byte[] audioData;

        AudioPlaybackPacket(int sequenceNumber, byte[] audioData) {
            this.sequenceNumber = sequenceNumber;
            this.audioData = audioData;
        }
    }

    /**
     * Handles real-time audio capture from microphone and playback to speakers.
     *
     * <p>This class manages two separate threads:</p>
     * <ul>
     *   <li>Capture thread: Continuously reads audio from microphone and sends to VoiceLive service</li>
     *   <li>Playback thread: Receives audio responses and plays them through speakers</li>
     * </ul>
     *
     * <p>Supports interruption handling where user speech can cancel ongoing assistant responses.</p>
     */
    private static class AudioProcessor {
        private final VoiceLiveSessionAsyncClient session;
        private final AudioFormat audioFormat;

        // Audio capture components
        private TargetDataLine microphone;
        private final AtomicBoolean isCapturing = new AtomicBoolean(false);

        // Audio playback components
        private SourceDataLine speaker;
        private final BlockingQueue<AudioPlaybackPacket> playbackQueue = new LinkedBlockingQueue<>();
        private final AtomicBoolean isPlaying = new AtomicBoolean(false);
        private final AtomicInteger nextSequenceNumber = new AtomicInteger(0);
        private final AtomicInteger playbackBase = new AtomicInteger(0);

        AudioProcessor(VoiceLiveSessionAsyncClient session) {
            this.session = session;
            this.audioFormat = new AudioFormat(
                AudioFormat.Encoding.PCM_SIGNED,
                SAMPLE_RATE,
                SAMPLE_SIZE_BITS,
                CHANNELS,
                CHANNELS * SAMPLE_SIZE_BITS / 8, // frameSize
                SAMPLE_RATE,
                false // bigEndian
            );
        }

        /**
         * Start capturing audio from microphone
         */
        void startCapture() {
            if (isCapturing.get()) {
                return;
            }

            try {
                DataLine.Info micInfo = new DataLine.Info(TargetDataLine.class, audioFormat);

                if (!AudioSystem.isLineSupported(micInfo)) {
                    throw new UnsupportedOperationException("Microphone not supported with required format");
                }

                microphone = (TargetDataLine) AudioSystem.getLine(micInfo);
                microphone.open(audioFormat, CHUNK_SIZE * AUDIO_BUFFER_SIZE_MULTIPLIER);
                microphone.start();

                isCapturing.set(true);

                // Start capture thread
                Thread captureThread = new Thread(this::captureAudioLoop, "VoiceLive-AudioCapture");
                captureThread.setDaemon(true);
                captureThread.start();

                System.out.println("🎤 Microphone capture started");

            } catch (LineUnavailableException e) {
                System.err.println("❌ Failed to start microphone: " + e.getMessage());
                throw new RuntimeException("Failed to initialize microphone", e);
            }
        }

        /**
         * Starts audio playback system.
         */
        void startPlayback() {
            if (isPlaying.get()) {
                return;
            }

            try {
                DataLine.Info speakerInfo = new DataLine.Info(SourceDataLine.class, audioFormat);

                if (!AudioSystem.isLineSupported(speakerInfo)) {
                    throw new UnsupportedOperationException("Speaker not supported with required format");
                }

                speaker = (SourceDataLine) AudioSystem.getLine(speakerInfo);
                speaker.open(audioFormat, CHUNK_SIZE * AUDIO_BUFFER_SIZE_MULTIPLIER);
                speaker.start();

                isPlaying.set(true);

                // Start playback thread
                Thread playbackThread = new Thread(this::playbackAudioLoop, "VoiceLive-AudioPlayback");
                playbackThread.setDaemon(true);
                playbackThread.start();

                System.out.println("🔊 Audio playback started");

            } catch (LineUnavailableException e) {
                System.err.println("❌ Failed to start speaker: " + e.getMessage());
                throw new RuntimeException("Failed to initialize speaker", e);
            }
        }

        /**
         * Audio capture loop - runs in separate thread
         */
        private void captureAudioLoop() {
            byte[] buffer = new byte[CHUNK_SIZE * 2]; // 16-bit samples
            System.out.println("🎤 Audio capture loop started");

            while (isCapturing.get() && microphone != null) {
                try {
                    int bytesRead = microphone.read(buffer, 0, buffer.length);
                    if (bytesRead > 0) {
                        // Send audio to VoiceLive service
                        byte[] audioChunk = Arrays.copyOf(buffer, bytesRead);

                        // Send audio asynchronously using the session's audio buffer append
                        session.sendInputAudio(BinaryData.fromBytes(audioChunk))
                            .subscribeOn(Schedulers.boundedElastic())
                            .subscribe(
                                v -> {}, // onNext
                                error -> {
                                    // Only log non-interruption errors
                                    if (!error.getMessage().contains("cancelled")) {
                                        System.err.println("❌ Error sending audio: " + error.getMessage());
                                    }
                                }
                            );
                    }
                } catch (Exception e) {
                    if (isCapturing.get()) {
                        System.err.println("❌ Error in audio capture: " + e.getMessage());
                    }
                    break;
                }
            }
            System.out.println("🎤 Audio capture loop ended");
        }

        /**
         * Audio playback loop - runs in separate thread
         */
        private void playbackAudioLoop() {
            while (isPlaying.get()) {
                try {
                    AudioPlaybackPacket packet = playbackQueue.take(); // Blocking wait

                    if (packet.audioData == null) {
                        // Shutdown signal
                        break;
                    }

                    // Check if packet should be skipped (interrupted)
                    int currentBase = playbackBase.get();
                    if (packet.sequenceNumber < currentBase) {
                        // Skip interrupted audio
                        continue;
                    }

                    // Play the audio
                    if (speaker != null && speaker.isOpen()) {
                        speaker.write(packet.audioData, 0, packet.audioData.length);
                    }

                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    System.err.println("❌ Error in audio playback: " + e.getMessage());
                }
            }
        }

        /**
         * Queue audio data for playback
         */
        void queueAudio(byte[] audioData) {
            if (audioData != null && audioData.length > 0) {
                int seqNum = nextSequenceNumber.getAndIncrement();
                playbackQueue.offer(new AudioPlaybackPacket(seqNum, audioData));
            }
        }

        /**
         * Skip pending audio (for interruption handling)
         */
        void skipPendingAudio() {
            playbackBase.set(nextSequenceNumber.get());
            playbackQueue.clear();

            // Also drain the speaker buffer to stop playback immediately
            if (speaker != null && speaker.isOpen()) {
                speaker.flush();
            }
        }

        /**
         * Stop capture and playback
         */
        void shutdown() {
            // Stop capture
            isCapturing.set(false);
            if (microphone != null) {
                microphone.stop();
                microphone.close();
                microphone = null;
            }
            System.out.println("🎤 Microphone capture stopped");

            // Stop playback
            isPlaying.set(false);
            playbackQueue.offer(new AudioPlaybackPacket(-1, null)); // Shutdown signal
            if (speaker != null) {
                speaker.stop();
                speaker.close();
                speaker = null;
            }
            System.out.println("🔊 Audio playback stopped");
        }
    }

    /**
     * Configuration class to hold application settings.
     */
    private static class Config {
        String endpoint;
        String apiKey;
        String model = DEFAULT_MODEL;
        String voice = DEFAULT_VOICE;
        String instructions = DEFAULT_INSTRUCTIONS;
        boolean useTokenCredential = false;

        static Config load(String[] args) {
            Config config = new Config();
            
            // 1. Load from application.properties first
            Properties props = loadProperties();
            if (props != null) {
                config.endpoint = props.getProperty("azure.voicelive.endpoint");
                config.apiKey = props.getProperty("azure.voicelive.api-key");
                config.model = props.getProperty("azure.voicelive.model", DEFAULT_MODEL);
                config.voice = props.getProperty("azure.voicelive.voice", DEFAULT_VOICE);
                config.instructions = props.getProperty("azure.voicelive.instructions", DEFAULT_INSTRUCTIONS);
            }
            
            // 2. Override with environment variables if present
            if (System.getenv(ENV_ENDPOINT) != null) {
                config.endpoint = System.getenv(ENV_ENDPOINT);
            }
            if (System.getenv(ENV_API_KEY) != null) {
                config.apiKey = System.getenv(ENV_API_KEY);
            }
            if (System.getenv("AZURE_VOICELIVE_MODEL") != null) {
                config.model = System.getenv("AZURE_VOICELIVE_MODEL");
            }
            if (System.getenv("AZURE_VOICELIVE_VOICE") != null) {
                config.voice = System.getenv("AZURE_VOICELIVE_VOICE");
            }
            if (System.getenv("AZURE_VOICELIVE_INSTRUCTIONS") != null) {
                config.instructions = System.getenv("AZURE_VOICELIVE_INSTRUCTIONS");
            }
            
            // 3. Parse command line arguments (highest priority)
            for (int i = 0; i < args.length; i++) {
                switch (args[i]) {
                    case "--endpoint":
                        if (i + 1 < args.length) config.endpoint = args[++i];
                        break;
                    case "--api-key":
                        if (i + 1 < args.length) config.apiKey = args[++i];
                        break;
                    case "--model":
                        if (i + 1 < args.length) config.model = args[++i];
                        break;
                    case "--voice":
                        if (i + 1 < args.length) config.voice = args[++i];
                        break;
                    case "--instructions":
                        if (i + 1 < args.length) config.instructions = args[++i];
                        break;
                    case "--use-token-credential":
                        config.useTokenCredential = true;
                        break;
                }
            }
            
            return config;
        }
    }

    /**
     * Load configuration from application.properties file.
     */
    private static Properties loadProperties() {
        Properties props = new Properties();
        try (InputStream input = new FileInputStream("application.properties")) {
            props.load(input);
            System.out.println("✓ Loaded configuration from application.properties");
            return props;
        } catch (IOException e) {
            // File not found or cannot be read - this is OK, will use env vars
            return null;
        }
    }

    /**
     * Main method to run the voice assistant sample.
     *
     * <p>Configuration priority (highest to lowest):</p>
     * <ol>
     *   <li>Command line arguments</li>
     *   <li>Environment variables</li>
     *   <li>application.properties file</li>
     * </ol>
     *
     * <p>Supported command line arguments:</p>
     * <ul>
     *   <li>--endpoint &lt;url&gt; - VoiceLive endpoint URL</li>
     *   <li>--api-key &lt;key&gt; - API key for authentication</li>
     *   <li>--model &lt;model&gt; - Model to use (default: gpt-4o-realtime-preview)</li>
     *   <li>--voice &lt;voice&gt; - Voice name (e.g., en-US-Ava:DragonHDLatestNeural)</li>
     *   <li>--instructions &lt;text&gt; - Custom system instructions</li>
     *   <li>--use-token-credential - Use Azure CLI authentication instead of API key</li>
     * </ul>
     *
     * @param args Command line arguments
     */
    public static void main(String[] args) {
        // Load configuration
        Config config = Config.load(args);

        // Validate configuration
        if (config.endpoint == null) {
            printUsage();
            return;
        }

        if (!config.useTokenCredential && config.apiKey == null) {
            System.err.println("❌ API key is required when not using --use-token-credential");
            System.err.println("   Set it via:");
            System.err.println("   - application.properties: azure.voicelive.api-key=<your-key>");
            System.err.println("   - Environment variable: AZURE_VOICELIVE_API_KEY=<your-key>");
            System.err.println("   - Command line: --api-key <your-key>");
            printUsage();
            return;
        }

        // Check audio system availability
        if (!checkAudioSystem()) {
            System.err.println("❌ Audio system check failed. Please ensure microphone and speakers are available.");
            return;
        }

        System.out.println("🎙️ Starting Voice Assistant...");
        System.out.println("   Model: " + config.model);
        if (config.voice != null) {
            System.out.println("   Voice: " + config.voice);
        }

        try {
            if (config.useTokenCredential) {
                // Use token credential authentication (Azure CLI)
                System.out.println("🔑 Using Token Credential authentication (Azure CLI)");
                System.out.println("   Make sure you have run 'az login' before running this sample");
                TokenCredential credential = new AzureCliCredentialBuilder().build();
                runVoiceAssistant(config, credential);
            } else {
                // Use API Key authentication
                System.out.println("🔑 Using API Key authentication");
                runVoiceAssistant(config, new KeyCredential(config.apiKey));
            }
            System.out.println("✓ Voice Assistant completed successfully");
        } catch (Exception e) {
            System.err.println("❌ Voice Assistant failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Check if audio system is available
     */
    private static boolean checkAudioSystem() {
        try {
            AudioFormat format = new AudioFormat(SAMPLE_RATE, SAMPLE_SIZE_BITS, CHANNELS, true, false);

            // Check microphone
            DataLine.Info micInfo = new DataLine.Info(TargetDataLine.class, format);
            if (!AudioSystem.isLineSupported(micInfo)) {
                System.err.println("❌ No compatible microphone found");
                return false;
            }

            // Check speaker
            DataLine.Info speakerInfo = new DataLine.Info(SourceDataLine.class, format);
            if (!AudioSystem.isLineSupported(speakerInfo)) {
                System.err.println("❌ No compatible speaker found");
                return false;
            }

            System.out.println("✓ Audio system check passed");
            return true;

        } catch (Exception e) {
            System.err.println("❌ Audio system check failed: " + e.getMessage());
            return false;
        }
    }

    /**
     * Prints usage instructions for setting up environment variables.
     */
    private static void printUsage() {
        System.err.println("\n═══════════════════════════════════════════════════════════════");
        System.err.println("Usage: mvn exec:java [options]");
        System.err.println("═══════════════════════════════════════════════════════════════");
        System.err.println("\nConfiguration (in priority order):");
        System.err.println("  1. Command line arguments (--endpoint, --api-key, etc.)");
        System.err.println("  2. Environment variables (AZURE_VOICELIVE_ENDPOINT, etc.)");
        System.err.println("  3. application.properties file");
        System.err.println("\nCommand Line Options:");
        System.err.println("  --endpoint <url>         VoiceLive endpoint URL");
        System.err.println("  --api-key <key>          API key for authentication");
        System.err.println("  --model <model>          Model to use (default: gpt-4o-realtime-preview)");
        System.err.println("  --voice <voice>          Voice name (e.g., en-US-Ava:DragonHDLatestNeural)");
        System.err.println("  --instructions <text>    Custom system instructions");
        System.err.println("  --use-token-credential   Use Azure CLI authentication");
        System.err.println("\nExamples:");
        System.err.println("  # Using application.properties:");
        System.err.println("  mvn exec:java");
        System.err.println("\n  # Using command line arguments:");
        System.err.println("  mvn exec:java -Dexec.args=\"--endpoint https://... --api-key <key>\"");
        System.err.println("\n  # Using Azure CLI authentication:");
        System.err.println("  mvn exec:java -Dexec.args=\"--use-token-credential\"");
        System.err.println("\n  # With custom model and voice:");
        System.err.println("  mvn exec:java -Dexec.args=\"--model gpt-4.1 --voice en-US-JennyNeural\"");
        System.err.println("═══════════════════════════════════════════════════════════════\n");
    }

    /**
     * Run the voice assistant with API key authentication.
     *
     * @param config The configuration object
     * @param credential The API key credential
     */
    private static void runVoiceAssistant(Config config, KeyCredential credential) {
        System.out.println("🔧 Initializing VoiceLive client:");
        System.out.println("   Endpoint: " + config.endpoint);

        // Create the VoiceLive client
        VoiceLiveAsyncClient client = new VoiceLiveClientBuilder()
            .endpoint(config.endpoint)
            .credential(credential)
            .serviceVersion(VoiceLiveServiceVersion.V2025_10_01)
            .buildAsyncClient();

        runVoiceAssistantWithClient(client, config);
    }

    /**
     * Run the voice assistant with Azure AD authentication.
     *
     * @param config The configuration object
     * @param credential The token credential
     */
    private static void runVoiceAssistant(Config config, TokenCredential credential) {
        System.out.println("🔧 Initializing VoiceLive client:");
        System.out.println("   Endpoint: " + config.endpoint);

        // Create the VoiceLive client
        VoiceLiveAsyncClient client = new VoiceLiveClientBuilder()
            .endpoint(config.endpoint)
            .credential(credential)
            .serviceVersion(VoiceLiveServiceVersion.V2025_10_01)
            .buildAsyncClient();

        runVoiceAssistantWithClient(client, config);
    }

    /**
     * Run the voice assistant with the configured client.
     *
     * @param client The VoiceLive async client
     * @param config The configuration object
     */
    private static void runVoiceAssistantWithClient(VoiceLiveAsyncClient client, Config config) {
        System.out.println("✓ VoiceLive client created");

        // Configure session options for voice conversation
        VoiceLiveSessionOptions sessionOptions = createVoiceSessionOptions(config);
        AtomicReference<AudioProcessor> audioProcessorRef = new AtomicReference<>();

        // Execute the reactive workflow - start with the configured model
        client.startSession(config.model)
            .flatMap(session -> {
                System.out.println("✓ Session started successfully");

                // Create audio processor
                AudioProcessor audioProcessor = new AudioProcessor(session);
                audioProcessorRef.set(audioProcessor);

                // Subscribe to receive server events asynchronously
                session.receiveEvents()
                    .doOnSubscribe(subscription -> System.out.println("🔗 Subscribed to event stream"))
                    .doOnComplete(() -> System.out.println("⚠️ Event stream completed (this might indicate a connection issue)"))
                    .doOnError(error -> System.out.println("❌ Event stream error: " + error.getMessage()))
                    .subscribe(
                        event -> handleServerEvent(event, audioProcessor),
                        error -> System.err.println("❌ Error receiving events: " + error.getMessage()),
                        () -> System.out.println("✓ Event stream completed")
                    );

                System.out.println("📤 Sending session.update configuration...");
                ClientEventSessionUpdate updateEvent = new ClientEventSessionUpdate(sessionOptions);
                session.sendEvent(updateEvent)
                    .doOnSuccess(v -> System.out.println("✓ Session configuration sent"))
                    .doOnError(error -> System.err.println("❌ Failed to send session.update: " + error.getMessage()))
                    .subscribe();


                // Start audio systems
                audioProcessor.startPlayback();

                System.out.println("🎤 VOICE ASSISTANT READY");
                System.out.println("Start speaking to begin conversation");
                System.out.println("Press Ctrl+C to exit");

                // Install shutdown hook for graceful cleanup
                Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                    System.out.println("\n🛑 Shutting down gracefully...");
                    audioProcessor.shutdown();
                }));

                // Keep the reactive chain alive to continue processing events
                // Mono.never() prevents the chain from completing, allowing the event stream to run
                // The shutdown hook above handles cleanup when the JVM exits (Ctrl+C)
                // Note: In production, use a proper signal mechanism (e.g., CountDownLatch, CompletableFuture)
                return Mono.never();
            })
            .doOnError(error -> System.err.println("❌ Error: " + error.getMessage()))
            .doFinally(signalType -> {
                // Cleanup audio processor
                AudioProcessor audioProcessor = audioProcessorRef.get();
                if (audioProcessor != null) {
                    audioProcessor.shutdown();
                }
            })
            .block(); // Block only for demo purposes; use reactive patterns in production
    }

    /**
     * Create session configuration for voice conversation
     */
    private static VoiceLiveSessionOptions createVoiceSessionOptions(Config config) {
        System.out.println("🔧 Creating session configuration:");

        // Create server VAD configuration similar to Python sample
        ServerVadTurnDetection turnDetection = new ServerVadTurnDetection()
            .setThreshold(0.5)
            .setPrefixPaddingMs(300)
            .setSilenceDurationMs(500)
            .setInterruptResponse(true)
            .setAutoTruncate(true)
            .setCreateResponse(true);

        // Create audio input transcription configuration
        AudioInputTranscriptionOptions transcriptionOptions = new AudioInputTranscriptionOptions(AudioInputTranscriptionOptionsModel.WHISPER_1);

        VoiceLiveSessionOptions options = new VoiceLiveSessionOptions()
            .setInstructions(config.instructions)
            // Voice: AzureStandardVoice for Azure TTS voices (e.g., en-US-Ava:DragonHDLatestNeural)
            .setVoice(BinaryData.fromObject(new AzureStandardVoice(config.voice)))
            .setModalities(Arrays.asList(InteractionModality.TEXT, InteractionModality.AUDIO))
            .setInputAudioFormat(InputAudioFormat.PCM16)
            .setOutputAudioFormat(OutputAudioFormat.PCM16)
            .setInputAudioSamplingRate(SAMPLE_RATE)
            .setInputAudioNoiseReduction(new AudioNoiseReduction(AudioNoiseReductionType.NEAR_FIELD))
            .setInputAudioEchoCancellation(new AudioEchoCancellation())
            .setInputAudioTranscription(transcriptionOptions)
            .setTurnDetection(turnDetection);


        System.out.println("✓ Session configuration created");
        return options;
    }

    /**
     * Handle incoming server events
     */
    private static void handleServerEvent(SessionUpdate event, AudioProcessor audioProcessor) {
        ServerEventType eventType = event.getType();

        try {
            if (eventType == ServerEventType.SESSION_CREATED) {
                System.out.println("✓ Session created - initializing...");
            } else if (eventType == ServerEventType.SESSION_UPDATED) {
                System.out.println("✓ Session updated - starting microphone");

                // Now that bufferObject() bug is fixed in generated code, we can access the typed class
                if (event instanceof SessionUpdateSessionUpdated) {
                    SessionUpdateSessionUpdated sessionUpdated = (SessionUpdateSessionUpdated) event;

                    // Print the full JSON representation
                    System.out.println("📄 Session Updated Event (Full JSON):");
                    String eventJson = BinaryData.fromObject(sessionUpdated).toString();
                    System.out.println(eventJson);
                }

                audioProcessor.startCapture();
            } else if (eventType == ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED) {
                System.out.println("🎤 Speech detected");
                // Server handles interruption automatically with interruptResponse=true
                // Just clear any pending audio in the playback queue
                audioProcessor.skipPendingAudio();
            } else if (eventType == ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STOPPED) {
                System.out.println("🤔 Speech ended - processing...");
            } else if (eventType == ServerEventType.RESPONSE_AUDIO_DELTA) {
                // Handle audio response - extract and queue for playback
                if (event instanceof SessionUpdateResponseAudioDelta) {
                    SessionUpdateResponseAudioDelta audioEvent = (SessionUpdateResponseAudioDelta) event;
                    byte[] audioData = audioEvent.getDelta();
                    if (audioData != null && audioData.length > 0) {
                        audioProcessor.queueAudio(audioData);
                    }
                }
            } else if (eventType == ServerEventType.RESPONSE_AUDIO_DONE) {
                System.out.println("🎤 Ready for next input...");
            } else if (eventType == ServerEventType.RESPONSE_DONE) {
                System.out.println("✅ Response complete");
            } else if (eventType == ServerEventType.ERROR) {
                if (event instanceof SessionUpdateError) {
                    SessionUpdateError errorEvent = (SessionUpdateError) event;
                    System.out.println("❌ VoiceLive error: " + errorEvent.getError().getMessage());
                } else {
                    System.out.println("❌ VoiceLive error occurred");
                }
            }
        } catch (Exception e) {
            System.err.println("❌ Error handling event: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
