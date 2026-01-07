class Pcm16DownsamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._targetSampleRate = 24000;
    this._inputSampleRate = sampleRate;
    this._ratio = this._inputSampleRate / this._targetSampleRate;
    this._carry = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channel0 = input[0];
    if (!channel0 || channel0.length === 0) return true;

    // Downsample by simple averaging. Good enough for speech.
    const outLength = Math.max(0, Math.floor((channel0.length - this._carry) / this._ratio));
    if (outLength === 0) return true;

    const pcm16 = new Int16Array(outLength);

    let outIndex = 0;
    let i = this._carry;

    while (outIndex < outLength) {
      const start = Math.floor(i);
      const end = Math.floor(i + this._ratio);

      let sum = 0;
      let count = 0;
      for (let j = start; j < end && j < channel0.length; j++) {
        sum += channel0[j];
        count++;
      }

      const sample = count > 0 ? sum / count : 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      pcm16[outIndex] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      outIndex++;
      i += this._ratio;
    }

    this._carry = i - channel0.length;
    if (this._carry < 0) this._carry = 0;

    // Transfer underlying buffer.
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor('pcm16-downsampler', Pcm16DownsamplerProcessor);
