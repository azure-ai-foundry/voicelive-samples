import { base64ToBytes } from "@/lib/base64";

export type Pcm16Chunk = {
  sampleRate: number;
  // little-endian int16 PCM
  bytes: Uint8Array;
};

export function pcm16Base64ToChunk(base64: string, sampleRate = 24000): Pcm16Chunk {
  return { sampleRate, bytes: base64ToBytes(base64) };
}

export function pcm16BytesToFloat32(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < out.length; i++) {
    const s = view.getInt16(i * 2, true);
    out[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
  }
  return out;
}

export class Pcm16Player {
  private audioContext: AudioContext;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();

  constructor(audioContext?: AudioContext) {
    this.audioContext = audioContext ?? new AudioContext({ sampleRate: 24000 });
  }

  async ensureRunning() {
    if (this.audioContext.state !== "running") await this.audioContext.resume();
  }

  enqueue(chunk: Pcm16Chunk) {
    const float32 = pcm16BytesToFloat32(chunk.bytes);

    const buffer = this.audioContext.createBuffer(1, float32.length, chunk.sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };

    const now = this.audioContext.currentTime;
    if (this.nextStartTime < now) this.nextStartTime = now;

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  stop() {
    this.nextStartTime = 0;
    for (const s of this.activeSources) {
      try {
        s.stop(0);
      } catch {
        // ignore
      }
    }
    this.activeSources.clear();
  }

  get context() {
    return this.audioContext;
  }
}
