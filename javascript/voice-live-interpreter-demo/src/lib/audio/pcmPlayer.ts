import { pcm16BytesToFloat32LE } from './pcm16'

export class Pcm16Player {
  private readonly audioContext: AudioContext
  private nextStartTime = 0
  private sources: AudioBufferSourceNode[] = []

  constructor() {
    this.audioContext = new AudioContext()
  }

  async resume(): Promise<void> {
    if (this.audioContext.state !== 'running') {
      await this.audioContext.resume()
    }
  }

  enqueuePcm16(bytes: Uint8Array, sampleRate = 16000) {
    const floatData = pcm16BytesToFloat32LE(bytes)
    const buffer = this.audioContext.createBuffer(1, floatData.length, sampleRate)
    buffer.getChannelData(0).set(floatData)

    const src = this.audioContext.createBufferSource()
    src.buffer = buffer
    src.connect(this.audioContext.destination)

    const now = this.audioContext.currentTime
    if (this.nextStartTime < now) this.nextStartTime = now
    const startAt = this.nextStartTime
    this.nextStartTime += buffer.duration

    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src)
    }
    this.sources.push(src)
    src.start(startAt)
  }

  stop() {
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        // ignore
      }
    }
    this.sources = []
    this.nextStartTime = 0
  }
}
