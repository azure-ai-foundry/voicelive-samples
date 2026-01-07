export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output
}

export function int16ToUint8LE(samples: Int16Array): Uint8Array {
  return new Uint8Array(samples.buffer)
}

export function pcm16BytesToFloat32LE(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const sampleCount = Math.floor(bytes.byteLength / 2)
  const out = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    const s = view.getInt16(i * 2, true)
    out[i] = s / 0x8000
  }
  return out
}
