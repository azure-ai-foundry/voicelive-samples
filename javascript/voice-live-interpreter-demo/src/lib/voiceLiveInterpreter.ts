import { AzureKeyCredential } from '@azure/core-auth'
import {
  VoiceLiveClient,
  type VoiceLiveSession,
  type VoiceLiveSubscription,
  type ServerEventResponseTextDelta,
  type ServerEventResponseTextDone,
  type ServerEventResponseDone,
  type ServerEventResponseCreated,
  type ServerEventResponseAudioDelta,
  type ServerEventConversationItemInputAudioTranscriptionDelta,
  type ServerEventConversationItemInputAudioTranscriptionCompleted,
  type ServerEventError,
  type VoiceLiveSessionHandlers,
} from '@azure/ai-voicelive'
import type { AppConfig } from './defaults'
import { inferPcmSampleRateFromOutputFormat, toRequestSession } from './defaults'
import { Pcm16Player } from './audio/pcmPlayer'
import type { TurnMetrics, Totals } from './metrics'
import { addUsage, EMPTY_TOTALS } from './metrics'

export type SessionLogLevel = 'info' | 'user' | 'input' | 'output' | 'error'

export type SessionLogItem = {
  id: string
  ts: number
  level: SessionLogLevel
  text: string
}

export type InterpreterState = {
  isConnected: boolean
  isMicOn: boolean
  logs: SessionLogItem[]
  turns: TurnMetrics[]
  totals: Totals
}

export type InterpreterEvents = {
  onState: (next: InterpreterState) => void
}

type TurnState = {
  metrics: TurnMetrics
  textBuffer: string
  ttsLogged?: boolean
}

export class VoiceLiveInterpreter {
  private client?: VoiceLiveClient
  private session?: VoiceLiveSession
  private subscription?: VoiceLiveSubscription

  private state: InterpreterState = {
    isConnected: false,
    isMicOn: false,
    logs: [],
    turns: [],
    totals: EMPTY_TOTALS,
  }

  private readonly turnMap = new Map<string, TurnState>()
  private readonly pcmPlayer = new Pcm16Player()
  private outputSampleRateHz = 24000
  private currentSpeechStartMs = 0
  private currentSpeechStopMs = 0

  private readonly events: InterpreterEvents

  constructor(events: InterpreterEvents) {
    this.events = events
  }

  get snapshot(): InterpreterState {
    return this.state
  }

  private setState(patch: Partial<InterpreterState>) {
    this.state = { ...this.state, ...patch }
    this.events.onState(this.state)
  }

  private log(level: SessionLogLevel, text: string) {
    const item: SessionLogItem = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ts: Date.now(),
      level,
      text,
    }
    const next = [...this.state.logs, item].slice(-2000)
    this.setState({ logs: next })
  }

  async connect(config: AppConfig) {
    if (this.state.isConnected) return

    if (!config.endpoint.trim()) throw new Error('Missing endpoint')
    if (!config.apiKey.trim()) throw new Error('Missing API key')

    this.log('info', 'Connecting…')

    this.client = new VoiceLiveClient(config.endpoint.trim(), new AzureKeyCredential(config.apiKey.trim()), {
      apiVersion: '2025-10-01',
      defaultSessionOptions: { enableDebugLogging: false },
    })

    const sessionConfig = toRequestSession(config)
    this.outputSampleRateHz = inferPcmSampleRateFromOutputFormat(sessionConfig.outputAudioFormat)
    this.session = await this.client.startSession(sessionConfig, { connectionTimeoutInMs: 30000 })

    // Attempt to enable audio playback from a user gesture (connect click).
    await this.pcmPlayer.resume()

    const handlers: VoiceLiveSessionHandlers = {
      onConnected: async (_args, ctx) => {
        console.log('[VoiceLive Event] onConnected', { args: _args, context: ctx })
        this.log('info', `Connected (sessionId=${ctx.sessionId ?? 'n/a'})`) 
      },
      onDisconnected: async (args) => {
        console.log('[VoiceLive Event] onDisconnected', args)
        this.log('info', `Disconnected (code=${args.code} reason=${args.reason})`)
      },
      onServerError: async (event: ServerEventError) => {
        console.log('[VoiceLive Event] onServerError', event)
        this.log('error', `Server error: ${event.error.message}`)
      },
      onConversationItemInputAudioTranscriptionDelta: async (
        event: ServerEventConversationItemInputAudioTranscriptionDelta,
      ) => {
        console.log('[VoiceLive Event] onConversationItemInputAudioTranscriptionDelta', event)
        if (event.delta) this.log('input', event.delta)
      },
      onConversationItemInputAudioTranscriptionCompleted: async (
        event: ServerEventConversationItemInputAudioTranscriptionCompleted,
      ) => {
        console.log('[VoiceLive Event] onConversationItemInputAudioTranscriptionCompleted', event)
        this.log('input', `🎤 ${event.transcript}`)
      },
      onInputAudioBufferSpeechStarted: async () => {
        console.log('[VoiceLive Event] onInputAudioBufferSpeechStarted')
        this.currentSpeechStartMs = Date.now()
        this.log('info', 'Speech detected')
      },
      onInputAudioBufferSpeechStopped: async () => {
        console.log('[VoiceLive Event] onInputAudioBufferSpeechStopped')
        this.currentSpeechStopMs = Date.now()
        this.log('info', 'Speech stopped')
      },
      onResponseCreated: async (event: ServerEventResponseCreated) => {
        console.log('[VoiceLive Event] onResponseCreated', event)
        const responseId = event.response.id ?? `resp_${Date.now()}`
        const metrics: TurnMetrics = { 
          responseId, 
          startedAtMs: Date.now(),
          speechStartedAtMs: this.currentSpeechStartMs,
          speechStoppedAtMs: this.currentSpeechStopMs
        }
        this.turnMap.set(responseId, { metrics, textBuffer: '' })
        this.log('info', `Response created (${responseId})`)
      },
      onResponseTextDelta: async (event: ServerEventResponseTextDelta) => {
        console.log('[VoiceLive Event] onResponseTextDelta', event)
        const turn = this.turnMap.get(event.responseId)
        if (!turn) return

        if (!turn.metrics.firstTextDeltaAtMs) {
          turn.metrics.firstTextDeltaAtMs = Date.now()
          turn.metrics.firstTokenLatencyMs = turn.metrics.firstTextDeltaAtMs - turn.metrics.startedAtMs
        }

        turn.textBuffer += event.delta
        this.turnMap.set(event.responseId, turn)
        this.events.onState(this.state)
      },
      onResponseTextDone: async (event: ServerEventResponseTextDone) => {
        console.log('[VoiceLive Event] onResponseTextDone', event)
        const responseId = event.responseId
        const turn = this.turnMap.get(responseId)

        const text = (event.text ?? '').trim()
        if (!text) return

        if (turn) {
          turn.textBuffer = text
          turn.ttsLogged = true
          this.turnMap.set(responseId, turn)
        }

        this.log('output', `🔊 ${text}`)
      },
      onResponseAudioDelta: async (event: ServerEventResponseAudioDelta) => {
        console.log('[VoiceLive Event] onResponseAudioDelta', { ...event, delta: event.delta instanceof Uint8Array ? `Uint8Array(${event.delta.length})` : event.delta })
        // Delta is base64 audio; SDK deserializer exposes as Uint8Array in browser builds.
        const chunk = event.delta
        if (chunk instanceof Uint8Array) {
          // Track first audio delta timing for latency calculation
          const turn = this.turnMap.get(event.responseId)
          if (turn && !turn.metrics.firstAudioDeltaAtMs) {
            const now = Date.now()
            turn.metrics.firstAudioDeltaAtMs = now
            
            // Calculate start latency (speech start -> first audio)
            if (turn.metrics.speechStartedAtMs) {
              turn.metrics.startLatencyMs = now - turn.metrics.speechStartedAtMs
            }
            
            // Calculate end latency (speech stopped -> first audio)
            if (turn.metrics.speechStoppedAtMs) {
              turn.metrics.endLatencyMs = now - turn.metrics.speechStoppedAtMs
            }
            
            this.turnMap.set(event.responseId, turn)
          }
          
          this.pcmPlayer.enqueuePcm16(chunk, this.outputSampleRateHz)
          // outputAudioSeconds is now calculated from outputAudioTokens in addUsage()
        }
      },
      onResponseDone: async (event: ServerEventResponseDone) => {
        console.log('[VoiceLive Event] onResponseDone', event)
        const responseId = event.response.id ?? 'unknown'
        const turn = this.turnMap.get(responseId)
        const finishedAtMs = Date.now()

        if (turn) {
          turn.metrics.finishedAtMs = finishedAtMs
          turn.metrics.latencyMs = finishedAtMs - turn.metrics.startedAtMs
          turn.metrics.assistantText = turn.textBuffer.trim()
          turn.metrics.usage = event.response.usage

          const nextTurns = [...this.state.turns, turn.metrics]
          let nextTotals = { ...this.state.totals }
          nextTotals.turns = nextTotals.turns + 1
          
          // Add latency metrics
          if (turn.metrics.startLatencyMs) {
            nextTotals.startLatencies = [...nextTotals.startLatencies, turn.metrics.startLatencyMs]
          }
          if (turn.metrics.endLatencyMs) {
            nextTotals.endLatencies = [...nextTotals.endLatencies, turn.metrics.endLatencyMs]
          }
          
          // Add token usage
          if (event.response.usage) {
            nextTotals = addUsage(nextTotals, event.response.usage)
            // Calculate cached audio time: cached audio tokens / 10
            nextTotals.cachedAudioSeconds = nextTotals.cachedAudioTokens / 10
          }

          this.setState({ turns: nextTurns, totals: nextTotals })

          this.log(
            'info',
            `Turn latency: ${turn.metrics.latencyMs ?? 0}ms; first-token: ${turn.metrics.firstTokenLatencyMs ?? 0}ms`,
          )
          
          // Extract TTS text from output content transcript
          if (!turn.ttsLogged) {
            let ttsText = '(no text)'
            if (event.response.output && event.response.output.length > 0) {
              const outputItem: any = event.response.output[0]
              if (outputItem?.content && Array.isArray(outputItem.content)) {
                const textContent = outputItem.content.find((c: any) => c.type === 'audio' && c.transcript)
                if (textContent?.transcript) {
                  ttsText = textContent.transcript
                }
              }
            }
            this.log('output', `🔊 ${ttsText}`)
          }
          
          if (event.response.usage) {
            this.log(
              'info',
              `Usage: in=${event.response.usage.inputTokens} out=${event.response.usage.outputTokens} total=${event.response.usage.totalTokens}`,
            )
          }
        } else {
          this.log('info', `Response done (${responseId})`)
        }

        this.turnMap.delete(responseId)
      },
      onError: async (args) => {
        console.log('[VoiceLive Event] onError', args)
        this.log('error', `${args.context}: ${args.error.message}`)
      },
    }

    this.subscription = this.session.subscribe(handlers)

    // Ensure session config (and prompt) is applied even when startSession used a config.
    await this.session.updateSession(sessionConfig)

    this.setState({ 
      isConnected: true,
      totals: { ...this.state.totals, sessionStartMs: Date.now() }
    })
    this.log('info', `Session configured (model=${config.model})`)
  }

  async disconnect() {
    this.setState({ isMicOn: false })

    try {
      this.pcmPlayer.stop()
      await this.subscription?.close()
      this.subscription = undefined

      await this.session?.dispose()
      this.session = undefined

      this.client = undefined
    } finally {
      this.turnMap.clear()
      this.setState({ isConnected: false })
      this.log('info', 'Disconnected')
    }
  }

  async applyConfig(config: AppConfig) {
    if (!this.session) throw new Error('Not connected')
    const sessionConfig = toRequestSession(config)
    this.outputSampleRateHz = inferPcmSampleRateFromOutputFormat(sessionConfig.outputAudioFormat)
    await this.session.updateSession(sessionConfig)
    this.log('info', 'Session updated')
  }

  async sendText(text: string) {
    if (!this.session) throw new Error('Not connected')
    const trimmed = text.trim()
    if (!trimmed) return

    this.log('user', trimmed)

    await this.session.addConversationItem({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: trimmed }],
    } as any)

    await this.session.sendEvent({
      type: 'response.create',
      response: { modalities: ['text', 'audio'] },
    })
  }

  async sendMicPcmChunk(pcm16leBytes: Uint8Array) {
    if (!this.session) return
    await this.session.sendAudio(pcm16leBytes)
    // inputAudioSeconds is now calculated from inputAudioTokens in addUsage()
  }
}
