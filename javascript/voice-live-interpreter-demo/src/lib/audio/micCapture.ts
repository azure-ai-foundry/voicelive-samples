import { floatTo16BitPCM, int16ToUint8LE } from './pcm16'

export type MicCaptureConfig = {
  sampleRate: number
  bufferSize: number
}

export type MicCaptureCallbacks = {
  onChunk: (pcm16leBytes: Uint8Array, durationSeconds: number) => void
  onState: (state: 'starting' | 'started' | 'stopping' | 'stopped' | 'error', detail?: string) => void
}

export class MicCapture {
  private mediaStream?: MediaStream
  private audioContext?: AudioContext
  private processor?: ScriptProcessorNode
  private source?: MediaStreamAudioSourceNode

  private readonly config: MicCaptureConfig
  private readonly callbacks: MicCaptureCallbacks

  constructor(config: MicCaptureConfig, callbacks: MicCaptureCallbacks) {
    this.config = config
    this.callbacks = callbacks
  }

  async start() {
    this.callbacks.onState('starting')
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Deprecated but widely supported; sufficient for a demo.
      this.processor = this.audioContext.createScriptProcessor(this.config.bufferSize, 1, 1)
      this.processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0)
        const pcm16 = floatTo16BitPCM(input)
        const bytes = int16ToUint8LE(pcm16)
        const durationSeconds = pcm16.length / this.config.sampleRate
        this.callbacks.onChunk(bytes, durationSeconds)
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      this.callbacks.onState('started')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.callbacks.onState('error', msg)
      await this.stop()
    }
  }

  async stop() {
    this.callbacks.onState('stopping')

    try {
      this.processor?.disconnect()
      this.source?.disconnect()
      this.processor = undefined
      this.source = undefined

      await this.audioContext?.close()
      this.audioContext = undefined

      this.mediaStream?.getTracks().forEach((t) => t.stop())
      this.mediaStream = undefined
    } finally {
      this.callbacks.onState('stopped')
    }
  }
}
