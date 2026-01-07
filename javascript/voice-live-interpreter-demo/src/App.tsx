import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildInterpreterPrompt,
  DEFAULT_CONFIG,
  MODEL_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
  type AppConfig,
} from './lib/defaults'
import { MicCapture } from './lib/audio/micCapture'
import { VoiceLiveInterpreter } from './lib/voiceLiveInterpreter'
import { calculatePercentile, calculateAverage, calculateCost } from './lib/metrics'

type UiLogItem = {
  id: string
  ts: number
  level: string
  text: string
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms)) return '-'
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function mapEndpointUrl(url: string): string {
  try {
    const pattern = /^(https:\/\/[^/]+)\.services\.ai\.azure\.com\/api\/projects\//
    const match = url.match(pattern)
    if (match) {
      const resourceName = match[1].replace('https://', '')
      return `https://${resourceName}.cognitiveservices.azure.com/`
    }
    return url
  } catch {
    return url
  }
}

function buildVoiceLiveCalcUrl(args: {
  turns: number
  inputAudioSeconds: number
  outputAudioSeconds: number
  inputTextTokens: number
  cachedTextTokens: number
  inputAudioTokens: number
  cachedAudioTokens: number
  model: string
}) {
  const textCachePct = args.inputTextTokens > 0 ? (args.cachedTextTokens / args.inputTextTokens) * 100 : 0
  const audioCachePct = args.inputAudioTokens > 0 ? (args.cachedAudioTokens / args.inputAudioTokens) * 100 : 0

  const url = new URL('https://novaaidesigner.github.io/azure-voice-live-calculator/')
  url.searchParams.set('dau', '1000')
  url.searchParams.set('turns', String(Math.max(0, Math.round(args.turns))))
  url.searchParams.set('inputAudio', String(Math.max(0, Math.round(args.inputAudioSeconds))))
  url.searchParams.set('outputAudio', String(Math.max(0, Math.round(args.outputAudioSeconds))))
  url.searchParams.set('inputText', String(Math.max(0, Math.round(args.inputTextTokens))))
  url.searchParams.set('model', args.model)
  url.searchParams.set('avatar', 'none')
  url.searchParams.set('textCache', String(Math.max(0, Math.round(textCachePct))))
  url.searchParams.set('audioCache', String(Math.max(0, Math.round(audioCachePct))))
  url.searchParams.set('tts', 'neural')
  return url.toString()
}

function App() {
  const [config, setConfig] = useState<AppConfig>(() => {
    const raw = localStorage.getItem('voicelive.config')
    if (!raw) {
      const c = { ...DEFAULT_CONFIG }
      c.prompt = buildInterpreterPrompt(c.targetLanguage)
      return c
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      const merged = { ...DEFAULT_CONFIG, ...parsed }
      merged.prompt = merged.prompt?.trim() ? merged.prompt : buildInterpreterPrompt(merged.targetLanguage)
      return merged
    } catch {
      const c = { ...DEFAULT_CONFIG }
      c.prompt = buildInterpreterPrompt(c.targetLanguage)
      return c
    }
  })

  const [statusText, setStatusText] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)
  const [isMicOn, setIsMicOn] = useState(false)
  const [logs, setLogs] = useState<UiLogItem[]>([])
  const [showInfoLogs, setShowInfoLogs] = useState(false)

  const [turns, setTurns] = useState(() => 0)
  const [sessionStartMs, setSessionStartMs] = useState(() => 0)
  const [inputAudioSeconds, setInputAudioSeconds] = useState(() => 0)
  const [inputAudioTokens, setInputAudioTokens] = useState(() => 0)
  const [cachedAudioSeconds, setCachedAudioSeconds] = useState(() => 0)
  const [cachedAudioTokens, setCachedAudioTokens] = useState(() => 0)
  const [outputAudioSeconds, setOutputAudioSeconds] = useState(() => 0)
  const [outputAudioTokens, setOutputAudioTokens] = useState(() => 0)
  const [inputTextTokens, setInputTextTokens] = useState(() => 0)
  const [cachedTextTokens, setCachedTextTokens] = useState(() => 0)
  const [outputTextTokens, setOutputTextTokens] = useState(() => 0)
  const [startLatencies, setStartLatencies] = useState<number[]>(() => [])
  const [endLatencies, setEndLatencies] = useState<number[]>(() => [])

  const interpreterRef = useRef<VoiceLiveInterpreter | null>(null)
  const micRef = useRef<MicCapture | null>(null)
  const logViewRef = useRef<HTMLDivElement | null>(null)
  const prevLangRef = useRef<string>(config.targetLanguage)

  if (!interpreterRef.current) {
    interpreterRef.current = new VoiceLiveInterpreter({
      onState: (s) => {
        setIsConnected(s.isConnected)
        setLogs(s.logs)
        setTurns(s.totals.turns)
        setSessionStartMs(s.totals.sessionStartMs)
        setInputAudioSeconds(s.totals.inputAudioSeconds)
        setInputAudioTokens(s.totals.inputAudioTokens)
        setCachedAudioSeconds(s.totals.cachedAudioSeconds)
        setCachedAudioTokens(s.totals.cachedAudioTokens)
        setOutputAudioSeconds(s.totals.outputAudioSeconds)
        setOutputAudioTokens(s.totals.outputAudioTokens)
        setInputTextTokens(s.totals.inputTextTokens)
        setCachedTextTokens(s.totals.cachedTextTokens)
        setOutputTextTokens(s.totals.outputTextTokens)
        setStartLatencies(s.totals.startLatencies)
        setEndLatencies(s.totals.endLatencies)
      },
    })
  }

  const interpreter = interpreterRef.current

  useEffect(() => {
    localStorage.setItem('voicelive.config', JSON.stringify(config))
  }, [config])

  useEffect(() => {
    const prevLang = prevLangRef.current
    if (prevLang === config.targetLanguage) return

    const prevDefault = buildInterpreterPrompt(prevLang)
    if (config.prompt.trim() === prevDefault.trim()) {
      setConfig((c) => ({ ...c, prompt: buildInterpreterPrompt(c.targetLanguage) }))
    }

    prevLangRef.current = config.targetLanguage
  }, [config.targetLanguage])

  useEffect(() => {
    const el = logViewRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs.length])

  const sessionTimeSeconds = sessionStartMs > 0 ? (Date.now() - sessionStartMs) / 1000 : 0
  const avgStartLatency = startLatencies.length > 0 ? calculateAverage(startLatencies) : 0
  const p90StartLatency = startLatencies.length > 0 ? calculatePercentile(startLatencies, 90) : 0
  const avgEndLatency = endLatencies.length > 0 ? calculateAverage(endLatencies) : 0
  
  // Determine model tier from current model (map to pricing tiers)
  const pricingTier = useMemo(() => {
    const modelOption = MODEL_OPTIONS.find(m => m.id === config.model)
    if (!modelOption) return 'standard' as const
    // Map 'basic' tier to 'standard' for pricing
    if (modelOption.tier === 'basic') return 'standard' as const
    return modelOption.tier as 'pro' | 'standard' | 'lite'
  }, [config.model])
  
  const totalCost = calculateCost(
    {
      turns,
      sessionStartMs,
      inputAudioSeconds,
      inputAudioTokens,
      cachedAudioSeconds,
      cachedAudioTokens,
      outputAudioSeconds,
      outputAudioTokens,
      inputTextTokens,
      cachedTextTokens,
      outputTextTokens,
      startLatencies,
      endLatencies,
    },
    pricingTier,
    config.voiceProvider
  )
  const costPerSecond = sessionTimeSeconds > 0 ? totalCost / sessionTimeSeconds : 0

  const visibleLogs = useMemo(() => {
    if (showInfoLogs) return logs
    return logs.filter((l) => l.level !== 'info')
  }, [logs, showInfoLogs])

  const calcUrl = useMemo(() => {
    return buildVoiceLiveCalcUrl({
      turns,
      inputAudioSeconds,
      outputAudioSeconds,
      inputTextTokens,
      cachedTextTokens,
      inputAudioTokens,
      cachedAudioTokens,
      model: config.model,
    })
  }, [
    cachedAudioTokens,
    cachedTextTokens,
    config.model,
    inputAudioSeconds,
    inputAudioTokens,
    inputTextTokens,
    outputAudioSeconds,
    turns,
  ])

  async function onConnect() {
    setStatusText('Connecting…')
    try {
      await interpreter.connect(config)
      setStatusText('Connected')
      await startMic()
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : String(e))
    }
  }

  async function onDisconnect() {
    setStatusText('Disconnecting…')
    try {
      await stopMic()
      await interpreter.disconnect()
      setStatusText('Disconnected')
    } catch (e) {
      setStatusText(e instanceof Error ? e.message : String(e))
    }
  }

  async function onResetAll() {
    const ok = window.confirm('Reset all settings and disconnect? This will reload the page.')
    if (!ok) return

    setStatusText('Resetting…')
    try {
      await stopMic()
    } catch {
      // ignore
    }
    try {
      await interpreter.disconnect()
    } catch {
      // ignore
    }
    try {
      // Preserve endpoint and API key
      const preserved = {
        endpoint: config.endpoint,
        apiKey: config.apiKey,
      }
      localStorage.removeItem('voicelive.config')
      const resetConfig = { ...DEFAULT_CONFIG, ...preserved }
      resetConfig.prompt = buildInterpreterPrompt(resetConfig.targetLanguage)
      localStorage.setItem('voicelive.config', JSON.stringify(resetConfig))
    } catch {
      // ignore
    }
    window.location.reload()
  }

  async function startMic() {
    if (isMicOn) return
    if (!interpreter.snapshot.isConnected) {
      setStatusText('Connect first')
      return
    }

    micRef.current = new MicCapture(
      { sampleRate: 16000, bufferSize: 4096 },
      {
        onChunk: (bytes) => {
          void interpreter.sendMicPcmChunk(bytes)
        },
        onState: (s, detail) => {
          if (s === 'started') setIsMicOn(true)
          if (s === 'stopped') setIsMicOn(false)
          if (s === 'error') setStatusText(detail ?? 'Mic error')
        },
      },
    )
    await micRef.current.start()
  }

  async function stopMic() {
    if (!micRef.current) {
      setIsMicOn(false)
      return
    }
    await micRef.current.stop()
    micRef.current = null
    setIsMicOn(false)
  }

  // Removed old avgLatencyMs and avgFirstTokMs computed values - replaced by new latency metrics

  const modelOptions = useMemo(() => {
    const tiers: Record<string, string[]> = {}
    for (const m of MODEL_OPTIONS) {
      tiers[m.tier] ??= []
      tiers[m.tier].push(m.id)
    }
    return tiers
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="title flex items-center gap-2">
          <img
            src="https://devblogs.microsoft.com/foundry/wp-content/uploads/sites/89/2025/03/ai-foundry.png"
            alt="Azure AI"
            className="w-6 h-6 object-contain"
          />
          <span>Azure Voice Live - Interpreter Demo</span>
        </div>
        <div className="status">
          <span className={isConnected ? 'dot dot-ok' : 'dot dot-off'} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          {statusText ? <span className="statusText">{statusText}</span> : null}
        </div>
      </header>

      <div className="grid">
        <section className="panel">
          <h2>Configuration</h2>
          <div className="panelScroll">
            <label>
              <span>Endpoint</span>
              <input
                value={config.endpoint}
                onChange={(e) => setConfig((c) => ({ ...c, endpoint: mapEndpointUrl(e.target.value) }))}
                placeholder="https://{your-voicelive-endpoint}"
                spellCheck={false}
              />
            </label>
            <label>
              <span>
                API Key -{' '}
                <a
                  href="https://ai.azure.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Get API Key/Endpoint Here 👈
                </a>{' '}
              </span>
              <input
                value={config.apiKey}
                onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
                placeholder="(kept in localStorage on this browser)"
                type="password"
                spellCheck={false}
              />
            </label>

            <div className="row2">
              <label>
                <span>Model</span>
                <select
                  value={config.model}
                  onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
                >
                  <optgroup label="Voice live pro">
                    {modelOptions.pro?.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Voice live basic">
                    {modelOptions.basic?.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Voice live lite">
                    {modelOptions.lite?.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <label>
                <span>Target Language</span>
                <select
                  value={config.targetLanguage}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      targetLanguage: e.target.value,
                    }))
                  }
                >
                  {TARGET_LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label} ({l.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="startRow">
              {!isConnected ? (
                <button className="btnStart btnBig" onClick={onConnect}>
                  ▶ Start
                </button>
              ) : (
                <button className="btnStop btnBig" onClick={onDisconnect}>
                  ⏹ Stop
                </button>
              )}
              <button
                type="button"
                className="btnReset"
                onClick={onResetAll}
                title="Reset all"
                aria-label="Reset all"
              >
                ↻
              </button>
            </div>

            <details className="details">
              <summary>Advanced (Prompt / ASR / Voice / Turn Detection)</summary>

            <label>
              <span className="flex items-center justify-between gap-3">
                <span>Prompt</span>
                <button
                  type="button"
                  className="btnInline"
                  onClick={() => setConfig((c) => ({ ...c, prompt: buildInterpreterPrompt(c.targetLanguage) }))}
                >
                  Reset
                </button>
              </span>
              <textarea
                value={config.prompt}
                onChange={(e) => setConfig((c) => ({ ...c, prompt: e.target.value }))}
                rows={8}
                spellCheck={false}
              />
            </label>

            <div className="row2">
              <label>
                <span>ASR Model</span>
                <select
                  value={config.asrModel}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      asrModel: e.target.value as AppConfig['asrModel'],
                    }))
                  }
                >
                  <option value="azure-speech">azure-speech</option>
                  <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe</option>
                  <option value="gpt-4o-transcribe">gpt-4o-transcribe</option>
                  <option value="whisper-1">whisper-1</option>
                </select>
              </label>
              <label>
                <span>ASR Languages (comma-separated)</span>
                <input
                  value={config.asrLanguages}
                  onChange={(e) => setConfig((c) => ({ ...c, asrLanguages: e.target.value }))}
                  placeholder="en,zh or en-US,zh-CN"
                  spellCheck={false}
                  disabled={config.asrModel !== 'azure-speech'}
                />
              </label>
            </div>

            <div className="row2">
              <label>
                <span>Voice Provider</span>
                <select
                  value={config.voiceProvider}
                  onChange={(e) => {
                    const nextProvider = e.target.value as AppConfig['voiceProvider']
                    setConfig((c) => ({
                      ...c,
                      voiceProvider: nextProvider,
                      voiceName: nextProvider === 'openai' ? 'alloy' : 'en-US-AvaMultilingualNeural',
                    }))
                  }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="azure-standard">Azure Neural</option>
                </select>
              </label>

              <label>
                <span>Voice</span>
                <select
                  value={config.voiceName}
                  onChange={(e) => setConfig((c) => ({ ...c, voiceName: e.target.value }))}
                >
                  {config.voiceProvider === 'openai' ? (
                    <>
                      <option value="alloy">Alloy (OpenAI)</option>
                      <option value="echo">Echo (OpenAI)</option>
                      <option value="fable">Fable (OpenAI)</option>
                      <option value="nova">Nova (OpenAI)</option>
                      <option value="shimmer">Shimmer (OpenAI)</option>
                    </>
                  ) : (
                    <>
                      <option value="en-US-AvaMultilingualNeural">Ava (Female, conversational)</option>
                      <option value="en-US-Ava:DragonHDLatestNeural">Ava HD (Female, friendly)</option>
                      <option value="en-US-AndrewMultilingualNeural">Andrew (Male, conversational)</option>
                      <option value="en-US-GuyMultilingualNeural">Guy (Male, professional)</option>
                      <option value="zh-CN-XiaochenMultilingualNeural">Xiaochen (Female, assistant)</option>
                      <option value="en-US-AndrewMultilingualNeural">Andrew (Male, calm)</option>
                    </>
                  )}
                </select>
              </label>
            </div>

            <div className="row2">
              <label>
                <span>Turn Detection</span>
                <select
                  value={config.turnDetectionType}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      turnDetectionType: e.target.value as AppConfig['turnDetectionType'],
                    }))
                  }
                >
                  <option value="server_vad">server_vad</option>
                  <option value="azure_semantic_vad">azure_semantic_vad</option>
                </select>
              </label>
              <label>
                <span>Threshold</span>
                <input
                  type="number"
                  step="0.05"
                  value={config.threshold}
                  onChange={(e) => setConfig((c) => ({ ...c, threshold: Number(e.target.value) }))}
                />
              </label>
            </div>

            <div className="row2">
              <label>
                <span>Prefix Padding (ms)</span>
                <input
                  type="number"
                  value={config.prefixPaddingInMs}
                  onChange={(e) => setConfig((c) => ({ ...c, prefixPaddingInMs: Number(e.target.value) }))}
                />
              </label>
              <label>
                <span>Silence (ms)</span>
                <input
                  type="number"
                  value={config.silenceDurationInMs}
                  onChange={(e) => setConfig((c) => ({ ...c, silenceDurationInMs: Number(e.target.value) }))}
                />
              </label>
            </div>

            <div className="row2">
              <label>
                <span>Speech Duration (ms)</span>
                <input
                  type="number"
                  value={config.speechDurationInMs}
                  onChange={(e) => setConfig((c) => ({ ...c, speechDurationInMs: Number(e.target.value) }))}
                  disabled={config.turnDetectionType !== 'azure_semantic_vad'}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={config.removeFillerWords}
                  onChange={(e) => setConfig((c) => ({ ...c, removeFillerWords: e.target.checked }))}
                  disabled={config.turnDetectionType !== 'azure_semantic_vad'}
                />
                <span>Remove filler words</span>
              </label>
            </div>

            <div className="row2">
              <label>
                <span>EOU Model</span>
                <select
                  value={config.eouModel}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      eouModel: e.target.value as AppConfig['eouModel'],
                    }))
                  }
                  disabled={config.turnDetectionType !== 'azure_semantic_vad'}
                >
                  <option value="semantic_detection_v1">semantic_detection_v1</option>
                </select>
              </label>
              <label>
                <span>EOU Threshold</span>
                <select
                  value={config.eouThresholdLevel}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      eouThresholdLevel: e.target.value as AppConfig['eouThresholdLevel'],
                    }))
                  }
                  disabled={config.turnDetectionType !== 'azure_semantic_vad'}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="default">default</option>
                </select>
              </label>
            </div>

            <label>
              <span>EOU Timeout (ms)</span>
              <input
                type="number"
                value={config.eouTimeoutInMs}
                onChange={(e) => setConfig((c) => ({ ...c, eouTimeoutInMs: Number(e.target.value) }))}
                disabled={config.turnDetectionType !== 'azure_semantic_vad'}
              />
            </label>
            </details>
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Statistics</h2>
            <div className="panelHeaderRight">
              <button
                onClick={() => window.open(calcUrl, '_blank', 'noopener,noreferrer')}
                disabled={turns === 0 && inputAudioSeconds === 0 && inputTextTokens === 0}
              >
                Export to VoiceLive Calc
              </button>
            </div>
          </div>
          <div className="panelScroll">
            <div className="metrics">
              <div className="metric" title="Number of conversation turns and total session duration">
                <span>Turns / Session Time <span className="infoIcon">ⓘ</span></span>
                <b>{turns} / {sessionTimeSeconds.toFixed(1)}s</b>
              </div>
              <div className="metric" title="Total cost calculated based on model tier, voice provider, and token usage">
                <span>Total Cost <span className="infoIcon">ⓘ</span></span>
                <b>${totalCost.toFixed(4)}</b>
              </div>
              <div className="metric" title="Average cost per second (Total Cost / Session Time)">
                <span>Cost/sec <span className="infoIcon">ⓘ</span></span>
                <b>${costPerSecond.toFixed(5)}/s</b>
              </div>
              <div className="metric" title="Total input audio time. Calculated as inputAudioTokens / 10">
                <span>Input Audio Time <span className="infoIcon">ⓘ</span></span>
                <b>{inputAudioSeconds.toFixed(1)}s ({inputAudioTokens} tok)</b>
              </div>
              <div className="metric" title="Cached audio time from prompt caching. Calculated as cachedAudioTokens / 10">
                <span>Cached Audio Time <span className="infoIcon">ⓘ</span></span>
                <b>{cachedAudioSeconds.toFixed(1)}s ({cachedAudioTokens} tok)</b>
              </div>
              <div className="metric" title="Total output audio time (TTS). Calculated as outputAudioTokens / 20">
                <span>Output Audio Time <span className="infoIcon">ⓘ</span></span>
                <b>{outputAudioSeconds.toFixed(1)}s ({outputAudioTokens} tok)</b>
              </div>
              <div className="metric" title="Total input text tokens (transcribed speech and system prompts)">
                <span>Input Text Tokens <span className="infoIcon">ⓘ</span></span>
                <b>{inputTextTokens}</b>
              </div>
              <div className="metric" title="Cached text tokens from prompt caching (reduces cost)">
                <span>Cached Text Tokens <span className="infoIcon">ⓘ</span></span>
                <b>{cachedTextTokens}</b>
              </div>
              <div className="metric" title="Total output text tokens (model responses)">
                <span>Output Text Tokens <span className="infoIcon">ⓘ</span></span>
                <b>{outputTextTokens}</b>
              </div>
              <div className="metric" title="Average time from user speech start to first audio output">
                <span>Avg Start Latency <span className="infoIcon">ⓘ</span></span>
                <b>{formatMs(avgStartLatency)}</b>
              </div>
              <div className="metric" title="90th percentile of start latency (speech start to first audio output)">
                <span>P90 Start Latency <span className="infoIcon">ⓘ</span></span>
                <b>{formatMs(p90StartLatency)}</b>
              </div>
              <div className="metric" title="Average time from user speech stop to corresponding audio output">
                <span>Avg End Latency <span className="infoIcon">ⓘ</span></span>
                <b>{formatMs(avgEndLatency)}</b>
              </div>
            </div>

            <div className="logHeader">
              <h3>Log</h3>
              <label className="logToggle" title="Show/hide INFO logs">
                <input
                  type="checkbox"
                  checked={showInfoLogs}
                  onChange={(e) => setShowInfoLogs(e.target.checked)}
                />
                <span>INFO</span>
              </label>
            </div>

            <div className="log" ref={logViewRef}>
              {visibleLogs.map((l) => (
                <div key={l.id} className={`logRow log-${l.level}`}>
                  <span className="logTs">{new Date(l.ts).toLocaleTimeString()}</span>
                  <span className="logLvl">{l.level.toUpperCase()}</span>
                  <span className="logText">{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
