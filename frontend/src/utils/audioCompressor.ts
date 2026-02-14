const TARGET_SAMPLE_RATE = 16000;

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) return audioBuffer.getChannelData(0);
  const len = audioBuffer.length;
  const mixed = new Float32Array(len);
  const channels = audioBuffer.numberOfChannels;
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) mixed[i] += data[i];
  }
  for (let i = 0; i < len; i++) mixed[i] /= channels;
  return mixed;
}

function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const newLen = Math.round(samples.length / ratio);
  const result = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, samples.length - 1);
    const frac = srcIdx - lo;
    result[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
  }
  return result;
}

export async function compressAudio(file: File): Promise<File> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();

  const mono = mixToMono(audioBuffer);
  const resampled = resample(mono, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
  const wavBuffer = encodeWav(resampled, TARGET_SAMPLE_RATE);

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([wavBuffer], `${baseName}_16k.wav`, { type: 'audio/wav' });
}

export function needsCompression(file: File): boolean {
  return file.size > 50 * 1024 * 1024;
}
