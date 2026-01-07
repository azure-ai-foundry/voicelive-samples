import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, Gauge, Play, Square, ChevronDown, ChevronUp, Radio, Navigation, Thermometer, RotateCcw } from 'lucide-react';
import { RealtimeClient } from './services/realtimeService';
import { carTools, executeCarTool } from './tools/carTools';
import { calculateEPASpeed, calculateBatteryConsumption, EPA_CYCLE_DURATION } from './utils/epaSimulator';
import Statistics from './components/Statistics';

function App() {
  // Cookie utility functions
  const setCookie = (name, value, days = 365) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  };

  const getCookie = (name) => {
    return document.cookie.split('; ').reduce((r, v) => {
      const parts = v.split('=');
      return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
  };

  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sessionConfigJson, setSessionConfigJson] = useState(JSON.stringify({
    modalities: ["text", "audio"],
    instructions: "You are a helpful car assistant, use simple and short oral response.",
    voice: "alloy",
    input_audio_format: "pcm16",
    output_audio_format: "pcm16",
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500
    },
    input_audio_echo_cancellation: {
      type: "server_echo_cancellation"
    },
    input_audio_noise_reduction: {
      type: "azure_deep_noise_suppression"
    },
    input_audio_transcription: {
      model: "whisper-1"
    },
    tools: carTools
  }, null, 2));

  const [carStatus, setCarStatus] = useState({
    speed: 0,
    battery: 80,
    batteryRange: 245,
    temperature: 22,
    lights: 'off',
    windows: 'closed',
    music: 'off',
    radioStation: 'FM 101.5',
    radioPlaying: true,
    mediaType: 'radio',
    mediaVolume: 70,
    navigationActive: false,
    navigationDestination: 'Not set',
    navigationDistance: '—'
  });
  
  const [config, setConfig] = useState(() => {
    const savedEndpoint = getCookie('azure_endpoint');
    const savedApiKey = getCookie('azure_apiKey');
    const initialSessionConfig = {
      modalities: ["text", "audio"],
      instructions: "You are a helpful car assistant, use simple and short oral response.",
      voice: "alloy",
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      input_audio_echo_cancellation: {
        type: "server_echo_cancellation"
      },
      input_audio_noise_reduction: {
        type: "azure_deep_noise_suppression"
      },
      input_audio_transcription: {
        model: "whisper-1"
      },
      tools: carTools
    };
    return {
      endpoint: savedEndpoint || '',
      apiKey: savedApiKey || '',
      apiVersion: '2025-10-01',
      modelCategory: 'LLM Realtime',
      model: 'gpt-realtime',
      sessionConfig: initialSessionConfig
    };
  });

  const [metrics, setMetrics] = useState({
    tokens: {
      input_text: 0,
      input_audio: 0,
      output_text: 0,
      output_audio: 0,
      cached_text: 0,
      cached_audio: 0
    },
    latency: {
      values: [],
      min: 0,
      avg: 0,
      max: 0,
      p90: 0
    },
    turns: 0
  });

  const clientRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const speechStartTimeRef = useRef(null);
  const playbackAudioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const logsEndRef = useRef(null);
  const firstAudioReceivedRef = useRef(false);

  // Save endpoint and apiKey to cookies when they change
  useEffect(() => {
    if (config.endpoint) {
      setCookie('azure_endpoint', config.endpoint);
    }
    if (config.apiKey) {
      setCookie('azure_apiKey', config.apiKey);
    }
  }, [config.endpoint, config.apiKey]);

  // Sync sessionConfigJson with sessionConfig
  useEffect(() => {
    setSessionConfigJson(JSON.stringify(config.sessionConfig, null, 2));
  }, [config.sessionConfig]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // EPA Cycle Simulation for BEV
  useEffect(() => {
    const epaInterval = setInterval(() => {
      setCarStatus(prev => {
        // EPA Federal Test Procedure: Total 1369 seconds (Cold Start 505s + Transient 864s)
        const time = Date.now() / 1000;
        const cyclePosition = time % EPA_CYCLE_DURATION; // Full EPA cycle
        
        // Get speed from EPA simulator
        const newSpeed = calculateEPASpeed(cyclePosition);
        
        // Calculate battery consumption
        const consumption = calculateBatteryConsumption(newSpeed);
        const newBattery = Math.max(0, prev.battery - consumption);
        const newRange = Math.round(newBattery * 3.1); // ~310 km at 100%

        // Debug log to verify speed updates
        if (Math.floor(time) % 10 === 0) { // Log every 5 seconds
          console.log(`[EPA Simulator] Speed: ${newSpeed} km/h, Battery: ${newBattery.toFixed(2)}%, Range: ${newRange} km`);
        }

        return {
          ...prev,
          speed: newSpeed,
          battery: Math.round(newBattery * 100) / 100,
          batteryRange: newRange
        };
      });
    }, 1000); // Update every 1 second

    return () => clearInterval(epaInterval);
  }, []);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const base64Audio = btoa(String.fromCharCode.apply(null, new Uint8Array(pcm16.buffer)));
        
        if (clientRef.current && clientRef.current.ws && clientRef.current.ws.readyState === WebSocket.OPEN) {
          clientRef.current.send({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      addLog('🎤 Recording started');
    } catch (error) {
      addLog(`❌ Failed to start recording: ${error.message}`, 'error');
    }
  };

  const stopRecording = () => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    addLog('🎤 Recording stopped');
  };

  const playAudio = async (base64Audio) => {
    try {
      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioContext = playbackAudioContextRef.current;
      
      // Decode base64 to PCM16
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7FFF);
      }
      
      const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      
      // Start playing if not already playing
      if (!isPlayingRef.current) {
        playNextAudioChunk();
      }
    } catch (error) {
      console.error('Audio playback error:', error);
    }
  };

  const playNextAudioChunk = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const audioContext = playbackAudioContextRef.current;
    const audioBuffer = audioQueueRef.current.shift();
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    // Calculate when to start this chunk
    const now = audioContext.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    
    source.start(startTime);
    
    // Update next play time
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
    
    // Schedule next chunk
    source.onended = () => {
      playNextAudioChunk();
    };
  };

  const clearAudioQueue = () => {
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    isPlayingRef.current = false;
  };

  const handleConnect = async () => {
    if (isConnected) {
      stopRecording();
      clearAudioQueue();
      clientRef.current?.disconnect();
      setIsConnected(false);
      addLog('Disconnected');
      return;
    }

    if (!config.endpoint || !config.apiKey) {
      alert('Please provide Endpoint and API Key, you can create a key from ai.azure.com.');
      return;
    }

    try {
      clientRef.current = new RealtimeClient(config);
      
      clientRef.current.on('open', () => {
        setIsConnected(true);
        addLog('Connected to Azure Voice Live');
      });

      clientRef.current.on('error', (err) => {
        addLog(`Error: ${err.message}`, 'error');
        setIsConnected(false);
      });

      clientRef.current.on('close', () => {
        setIsConnected(false);
        stopRecording();
        clearAudioQueue();
        addLog('Connection closed');
      });

      clientRef.current.on('message', async (event) => {
        console.log('Event:', event.type, event);
        
        // Session ready
        if (event.type === 'session.updated' || event.type === 'session.created') {
          addLog('✅ Session ready');
        }
        
        // User speech detection
        if (event.type === 'input_audio_buffer.speech_started') {
          clearAudioQueue();
          addLog('🎤 Speech started');
        }
        
        if (event.type === 'input_audio_buffer.speech_stopped') {
          speechStartTimeRef.current = Date.now();
          firstAudioReceivedRef.current = false;
          addLog('🎤 Speech stopped');
        }
        
        if (event.type === 'input_audio_buffer.committed') {
          addLog('📝 Audio committed');
        }
        
        // User transcription
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          addLog(`👤 You: ${event.transcript}`, 'user');
        }
        
        // Response events
        if (event.type === 'response.created') {
          addLog('🤖 Assistant responding...');
        }
        
        // Assistant text output
        if (event.type === 'response.text.delta') {
          // Accumulate text deltas if needed
        }
        
        if (event.type === 'response.text.done') {
          addLog(`🤖 Assistant: ${event.text}`, 'assistant');
        }
        
        if (event.type === 'response.audio_transcript.delta') {
          // Audio transcript chunks
        }
        
        if (event.type === 'response.audio_transcript.done') {
          if (event.transcript) {
            addLog(`🤖 Assistant: ${event.transcript}`, 'assistant');
          }
        }
        
        // Audio playback
        if (event.type === 'response.audio.delta') {
          if (event.delta) {
            // Calculate latency on first audio chunk
            if (!firstAudioReceivedRef.current && speechStartTimeRef.current) {
              const latency = Date.now() - speechStartTimeRef.current;
              firstAudioReceivedRef.current = true;
              
              setMetrics(prev => {
                const newLatencies = [...prev.latency.values, latency];
                const sortedLatencies = [...newLatencies].sort((a, b) => a - b);
                const p90Index = Math.ceil(sortedLatencies.length * 0.9) - 1;
                
                return {
                  ...prev,
                  latency: {
                    values: newLatencies,
                    min: newLatencies.length > 0 ? Math.min(...newLatencies) : 0,
                    avg: newLatencies.length > 0 ? Math.round(newLatencies.reduce((a, b) => a + b, 0) / newLatencies.length) : 0,
                    max: newLatencies.length > 0 ? Math.max(...newLatencies) : 0,
                    p90: sortedLatencies.length > 0 ? sortedLatencies[p90Index] || 0 : 0
                  }
                };
              });
            }
            playAudio(event.delta);
          }
        }
        
        if (event.type === 'response.audio.done') {
          addLog('🔊 Audio playback complete');
        }
        
        // Function calling
        if (event.type === 'conversation.item.created') {
          if (event.item && event.item.type === 'function_call') {
            addLog(`🔧 Function call: ${event.item.name}`, 'tool');
          }
        }
        
        if (event.type === 'response.function_call_arguments.done') {
          const { name, arguments: args, call_id } = event;
          addLog(`🔧 Executing: ${name}(${args})`, 'tool');
          const result = await executeCarTool(name, JSON.parse(args), setCarStatus, carStatus);
          addLog(`✅ Result: ${JSON.stringify(result)}`, 'tool');
          clientRef.current.sendToolOutput(call_id, result);
        }
        
        // Response complete with metrics
        if (event.type === 'response.done') {
          if (event.response && event.response.usage) {
            const usage = event.response.usage;
            
            // Log the raw usage JSON
            console.log('Usage:', JSON.stringify(usage, null, 2));
            
            const inputText = usage.input_tokens || 0;
            const inputAudio = usage.input_token_details?.audio_tokens || 0;
            const outputText = usage.output_token_details?.text_tokens || 0;
            const outputAudio = usage.output_token_details?.audio_tokens || 0;
            const cachedText = usage.input_token_details?.cached_tokens || 0;
            const cachedAudio = usage.input_token_details?.cached_audio_tokens || 0;
            
            setMetrics(prev => ({
              ...prev,
              tokens: {
                input_text: prev.tokens.input_text + inputText,
                input_audio: prev.tokens.input_audio + inputAudio,
                output_text: prev.tokens.output_text + outputText,
                output_audio: prev.tokens.output_audio + outputAudio,
                cached_text: prev.tokens.cached_text + cachedText,
                cached_audio: prev.tokens.cached_audio + cachedAudio
              },
              turns: prev.turns + 1
            }));
          }
          addLog('✅ Response complete');
        }
        
        // Errors
        if (event.type === 'error') {
          addLog(`❌ Error: ${event.error?.message || 'Unknown error'}`, 'error');
        }
      });
      
      clientRef.current.setTools(carTools);
      await clientRef.current.connect();
    } catch (error) {
      addLog(`Connection failed: ${error.message}`, 'error');
      setIsConnected(false);
    }
  };

  const handleReset = () => {
    // Disconnect if connected
    if (isConnected) {
      stopRecording();
      clearAudioQueue();
      clientRef.current?.disconnect();
      setIsConnected(false);
    }
    
    // Clear logs
    setLogs([]);
    
    // Reset metrics
    setMetrics({
      tokens: {
        input_text: 0,
        input_audio: 0,
        output_text: 0,
        output_audio: 0,
        cached_text: 0,
        cached_audio: 0
      },
      latency: {
        values: [],
        min: 0,
        avg: 0,
        max: 0,
        p90: 0
      },
      turns: 0
    });
    
    addLog('🔄 Reset complete');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
            <img src="https://devblogs.microsoft.com/foundry/wp-content/uploads/sites/89/2025/03/ai-foundry.png" alt="Azure AI" className="w-6 h-6 object-contain" />
            Azure Voice Live - Car Assistant
          </h1>
          <div className={`text-sm font-semibold ${isConnected ? 'text-green-400' : 'text-gray-400'}`}>
            {isConnected ? '● Connected' : '● Disconnected'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* LEFT SIDEBAR: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Configuration Panel */}
            <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings size={18} /> Configuration
              </h2>
              
              <div className="space-y-4">
                {/* Model Architecture */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Model Architecture</label>
                  <select 
                    value={config.modelCategory}
                    onChange={e => {
                      const category = e.target.value;
                      let defaultModel = '';
                      let defaultVoice = '';
                      
                      if (category === 'LLM Realtime') {
                        defaultModel = 'gpt-realtime';
                        defaultVoice = 'alloy'; // OpenAI voice for LLM Realtime
                      } else if (category === 'LLM+TTS') {
                        defaultModel = 'gpt-realtime';
                        defaultVoice = 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural'; // Azure voice for LLM+TTS
                      } else if (category === 'ASR+LLM+TTS') {
                        defaultModel = 'gpt-4o';
                        defaultVoice = 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural'; // Azure voice for ASR+LLM+TTS
                      }
                      
                      const newSessionConfig = {...config.sessionConfig, model: defaultModel, voice: defaultVoice};
                      setConfig({...config, modelCategory: category, model: defaultModel, sessionConfig: newSessionConfig});
                      setSessionConfigJson(JSON.stringify(newSessionConfig, null, 2));
                    }}
                    disabled={isConnected}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="LLM Realtime">LLM Realtime</option>
                    <option value="LLM+TTS">LLM+TTS</option>
                    <option value="ASR+LLM+TTS">ASR+LLM+TTS</option>
                  </select>
                </div>

                {/* Model */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Model</label>
                  <select 
                    value={config.model}
                    onChange={e => {
                      const newModel = e.target.value;
                      const newSessionConfig = {...config.sessionConfig, model: newModel};
                      setConfig({...config, model: newModel, sessionConfig: newSessionConfig});
                      setSessionConfigJson(JSON.stringify(newSessionConfig, null, 2));
                    }}
                    disabled={isConnected}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {config.modelCategory === 'LLM Realtime' && (
                      <>
                        <option value="gpt-realtime">gpt-realtime</option>
                        <option value="gpt-realtime-mini">gpt-realtime-mini</option>
                      </>
                    )}
                    {config.modelCategory === 'LLM+TTS' && (
                      <>
                        <option value="gpt-realtime">gpt-realtime</option>
                        <option value="gpt-realtime-mini">gpt-realtime-mini</option>
                        <option value="phi4-mm-realtime">phi4-mm-realtime</option>
                      </>
                    )}
                    {config.modelCategory === 'ASR+LLM+TTS' && (
                      <>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                        <option value="gpt-4.1">gpt-4.1</option>
                        <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                        <option value="gpt-5">gpt-5</option>
                        <option value="gpt-5-mini">gpt-5-mini</option>
                        <option value="gpt-5-nano">gpt-5-nano</option>
                        <option value="gpt-5-chat">gpt-5-chat</option>
                        <option value="phi4-mini">phi4-mini</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Voice */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Voice</label>
                  <select 
                    value={config.sessionConfig.voice || ''}
                    onChange={e => {
                      const newVoice = e.target.value;
                      const newSessionConfig = {...config.sessionConfig, voice: newVoice};
                      setConfig({...config, sessionConfig: newSessionConfig});
                      setSessionConfigJson(JSON.stringify(newSessionConfig, null, 2));
                    }}
                    disabled={isConnected}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {config.modelCategory === 'LLM Realtime' ? (
                      <>
                        <option value="alloy">Alloy (OpenAI)</option>
                        <option value="echo">Echo (OpenAI)</option>
                        <option value="fable">Fable (OpenAI)</option>
                        <option value="nova">Nova (OpenAI)</option>
                        <option value="shimmer">Shimmer (OpenAI)</option>
                      </>
                    ) : (
                      <>
                        <option value="zh-CN-Xiaoxiao:DragonHDFlashLatestNeural">Xiaoxiao HD (Female, warm)</option>
                        <option value="en-US-AvaMultilingualNeural">Ava (Female, conversational)</option>
                        <option value="en-US-Ava:DragonHDLatestNeural">Ava HD (Female, friendly)</option>
                        <option value="en-US-AndrewMultilingualNeural">Andrew (Male, conversational)</option>
                        <option value="en-US-GuyMultilingualNeural">Guy (Male, professional)</option>
                        <option value="zh-CN-XiaochenMultilingualNeural">Xiaochen (Female, assistant)</option>
                        <option value="en-US-AndrewMultilingualNeural">Andrew (Male, calm)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Endpoint */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Endpoint</label>
                  <input 
                    type="text" 
                    value={config.endpoint}
                    onChange={e => setConfig({...config, endpoint: e.target.value})}
                    disabled={isConnected}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="wss://resource.services.ai.azure.com"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">API Key - <a href="https://ai.azure.com" target="_blank" rel="noopener noreferrer" className="underline">Get API Key/Endpoint Here 👈</a></label>
                  <input 
                    type="password" 
                    value={config.apiKey}
                    onChange={e => setConfig({...config, apiKey: e.target.value})}
                    disabled={isConnected}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Advanced Settings */}
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full text-left text-xs text-gray-400 hover:text-gray-300 font-semibold flex justify-between items-center py-2 px-2 rounded hover:bg-gray-700"
                >
                  <span>Advanced Settings</span>
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdvanced && (
                  <div className="bg-gray-750 p-3 rounded border border-gray-600 space-y-3">
                    {/* Instructions */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 font-semibold">Instructions</label>
                      <textarea 
                        value={config.sessionConfig.instructions}
                        onChange={e => {
                          const newSessionConfig = { ...config.sessionConfig, instructions: e.target.value };
                          setConfig({...config, sessionConfig: newSessionConfig});
                          setSessionConfigJson(JSON.stringify(newSessionConfig, null, 2));
                        }}
                        disabled={isConnected}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs h-20 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="System instructions..."
                      />
                    </div>

                    {/* Turn Detection */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 font-semibold">VAD Threshold</label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={config.sessionConfig.turn_detection?.threshold || 0.5}
                        onChange={e => setConfig({
                          ...config,
                          sessionConfig: {
                            ...config.sessionConfig,
                            turn_detection: {
                              ...config.sessionConfig.turn_detection,
                              threshold: parseFloat(e.target.value)
                            }
                          }
                        })}
                        disabled={isConnected}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Full JSON Editor */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 font-semibold">Session JSON</label>
                      <textarea 
                        value={sessionConfigJson}
                        onChange={e => {
                          setSessionConfigJson(e.target.value);
                          try {
                              const parsed = JSON.parse(e.target.value);
                              setConfig(prev => ({ ...prev, sessionConfig: parsed }));
                          } catch (err) {
                              // Invalid JSON
                          }
                        }}
                        disabled={isConnected}
                        className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-xs font-mono h-32 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                {/* Connect and Reset Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={handleConnect}
                    className={`flex-1 py-2 rounded font-semibold flex justify-center items-center gap-2 text-sm transition ${isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {isConnected ? <><Square size={16} /> Disconnect</> : <><Play size={16} /> Connect</>}
                  </button>
                  
                  <button 
                    onClick={handleReset}
                    className="px-3 py-2 rounded font-semibold flex justify-center items-center transition bg-gray-600 hover:bg-gray-500"
                    title="Reset chat and statistics"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Car Status Panel */}
            <div className="bg-gray-800 p-5 rounded-lg border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Gauge size={18} /> Vehicle Status
              </h2>
              
              <div className="space-y-3 text-sm">
                {/* Basic Status */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 text-xs">Speed</div>
                    <div className="font-mono text-lg">{carStatus.speed}</div>
                    <div className="text-gray-500 text-xs">km/h</div>
                  </div>
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 text-xs">Battery</div>
                    <div className="font-mono text-lg">{carStatus.battery}%</div>
                    <div className="text-gray-500 text-xs">{carStatus.batteryRange} km</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 text-xs">Lights</div>
                    <div className="font-mono capitalize text-sm">{carStatus.lights}</div>
                  </div>
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 text-xs">Windows</div>
                    <div className="font-mono capitalize text-sm">{carStatus.windows}</div>
                  </div>
                </div>

                {/* Climate Control */}
                <div className="bg-gray-700 p-3 rounded border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer size={14} className="text-orange-400" />
                    <span className="text-xs text-gray-400 font-semibold">CLIMATE</span>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Temperature</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCarStatus({...carStatus, temperature: Math.max(16, carStatus.temperature - 1)})}
                        className="bg-gray-600 hover:bg-gray-500 text-white rounded px-2 py-1 text-xs"
                      >
                        −
                      </button>
                      <span className="text-white font-semibold text-sm min-w-[3rem] text-center">
                        {carStatus.temperature}°C
                      </span>
                      <button
                        onClick={() => setCarStatus({...carStatus, temperature: Math.min(30, carStatus.temperature + 1)})}
                        className="bg-gray-600 hover:bg-gray-500 text-white rounded px-2 py-1 text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Media Player */}
                <div className="bg-gray-700 p-3 rounded border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <Radio size={14} className="text-blue-400" />
                    <span className="text-xs text-gray-400 font-semibold">MEDIA</span>
                  </div>
                  
                  {/* Media Type Selection */}
                  <div className="mb-2">
                    <select 
                      value={carStatus.mediaType}
                      onChange={e => setCarStatus({...carStatus, mediaType: e.target.value})}
                      className="w-full bg-gray-600 border border-gray-500 rounded p-1 text-xs text-white"
                    >
                      <option value="radio">Radio</option>
                      <option value="music">Music</option>
                      <option value="podcast">Podcast</option>
                      <option value="audiobook">Audiobook</option>
                    </select>
                  </div>

                  {/* Current Media Info */}
                  <div className="text-xs font-mono mb-2 text-gray-300">
                    {carStatus.mediaType === 'radio' && carStatus.radioStation}
                    {carStatus.mediaType === 'music' && 'My Playlist'}
                    {carStatus.mediaType === 'podcast' && 'Tech Talk #127'}
                    {carStatus.mediaType === 'audiobook' && 'Digital Fortress'}
                  </div>

                  {/* Volume Control */}
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-400">Volume</span>
                      <span className="text-xs text-white font-semibold">{carStatus.mediaVolume}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={carStatus.mediaVolume}
                      onChange={e => setCarStatus({...carStatus, mediaVolume: parseInt(e.target.value)})}
                      className="w-full h-1 bg-gray-600 rounded-lg appearance-none slider"
                    />
                  </div>
                </div>

                {/* Navigator Status */}
                <div className="bg-gray-700 p-3 rounded border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation size={14} className="text-green-400" />
                    <span className="text-xs text-gray-400 font-semibold">NAVIGATION</span>
                  </div>
                  <div className="text-xs text-gray-300 mb-2">
                    <div className="truncate">{carStatus.navigationDestination}</div>
                    <div className="text-gray-500">{carStatus.navigationDistance}</div>
                  </div>
                  <button 
                    onClick={() => setCarStatus({...carStatus, navigationActive: !carStatus.navigationActive})}
                    className={`w-full py-1 rounded text-xs ${carStatus.navigationActive ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'}`}
                  >
                    {carStatus.navigationActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Chat/Voice Interface */}
          <div className="lg:col-span-3 flex flex-col gap-6 h-full">
            {/* Chat Panel - Flexible height */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col" style={{ height: 'calc(100vh - 480px)', minHeight: '400px' }}>
              {/* Chat/Logs Area */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1" style={{ maxHeight: '100%' }}>
                {logs.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-2">Connect and start speaking...</p>
                  </div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className={`text-xs px-2 py-1 rounded flex items-start gap-2 break-words ${
                    log.type === 'user' ? 'bg-blue-900/30 border-l-2 border-blue-500' :
                    log.type === 'assistant' ? 'bg-green-900/30 border-l-2 border-green-500' :
                    log.type === 'tool' ? 'bg-yellow-900/30 border-l-2 border-yellow-500' :
                    log.type === 'error' ? 'bg-red-900/30 border-l-2 border-red-500' :
                    'bg-gray-800/30'
                  }`}>
                    <span className="text-gray-500 shrink-0">[{log.time}]</span>
                    <span className={`flex-1 break-words ${
                      log.type === 'user' ? 'text-blue-300' :
                      log.type === 'assistant' ? 'text-green-300' :
                      log.type === 'tool' ? 'text-yellow-300' :
                      log.type === 'error' ? 'text-red-300' :
                      'text-gray-300'
                    }`}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>

              {/* Microphone Button */}
              <div className="border-t border-gray-700 p-4 flex justify-center">
                <button 
                  className={`p-6 rounded-full transition transform ${
                    isRecording ? 'bg-red-500 scale-110 animate-pulse' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  onClick={() => isRecording ? stopRecording() : startRecording()}
                  disabled={!isConnected}
                >
                  {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                </button>
              </div>
            </div>

            {/* Token Usage Panel - Below Chat */}
            <Statistics metrics={metrics} config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
