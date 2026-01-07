import type { RequestSession, TurnDetectionUnion } from '@azure/ai-voicelive'

export type VoiceLiveModelTier = 'pro' | 'basic' | 'lite'

export const MODEL_OPTIONS: Array<{ tier: VoiceLiveModelTier; id: string }> = [
  { tier: 'pro', id: 'gpt-realtime' },
  { tier: 'pro', id: 'gpt-4o' },
  { tier: 'pro', id: 'gpt-4.1' },
  { tier: 'pro', id: 'gpt-5' },
  { tier: 'pro', id: 'gpt-5-chat' },
  { tier: 'basic', id: 'gpt-realtime-mini' },
  { tier: 'basic', id: 'gpt-4o-mini' },
  { tier: 'basic', id: 'gpt-4.1-mini' },
  { tier: 'basic', id: 'gpt-5-mini' },
  { tier: 'lite', id: 'gpt-5-nano' },
  { tier: 'lite', id: 'phi4-mm-realtime' },
  { tier: 'lite', id: 'phi4-mini' },
]

export const TARGET_LANGUAGE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'sv', label: 'Svenska' },
  { code: 'no', label: 'Norsk' },
  { code: 'da', label: 'Dansk' },
  { code: 'fi', label: 'Suomi' },
  { code: 'pl', label: 'Polski' },
  { code: 'cs', label: 'Čeština' },
  { code: 'hu', label: 'Magyar' },
  { code: 'ro', label: 'Română' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'he', label: 'עברית' },
]

export type AppConfig = {
  endpoint: string
  apiKey: string
  model: string
  targetLanguage: string
  asrModel: 'azure-speech' | 'whisper-1' | 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe'
  asrLanguages: string
  voiceProvider: 'openai' | 'azure-standard'
  voiceName: string
  prompt: string
  turnDetectionType: 'server_vad' | 'azure_semantic_vad'
  threshold: number
  prefixPaddingInMs: number
  silenceDurationInMs: number
  speechDurationInMs: number
  removeFillerWords: boolean
  eouModel: 'semantic_detection_v1'
  eouThresholdLevel: 'low' | 'medium' | 'high' | 'default'
  eouTimeoutInMs: number
}

export const DEFAULT_CONFIG: AppConfig = {
  endpoint: '',
  apiKey: '',
  model: 'gpt-4.1-mini',
  targetLanguage: 'en',
  asrModel: 'azure-speech',
  // Comma-separated languages/locales for auto-detection. Example: "en,zh" or "en-US,zh-CN".
  asrLanguages: '',
  voiceProvider: 'azure-standard',
  voiceName: 'en-US-AvaMultilingualNeural',
  prompt: '',
  // azure-speech transcription requires azure_semantic_vad
  turnDetectionType: 'azure_semantic_vad',
  threshold: 0.5,
  prefixPaddingInMs: 300,
  silenceDurationInMs: 200,
  speechDurationInMs: 80,
  removeFillerWords: false,
  eouModel: 'semantic_detection_v1',
  eouThresholdLevel: 'default',
  eouTimeoutInMs: 1000,
}

export function buildInterpreterPrompt(targetLanguage: string): string {
  return [
    'You are a simultaneous interpreter.',
    `Target language: ${targetLanguage}.`,
    '',
    'Rules:',
    '1) Translate sentence by sentence (output each sentence as it completes).',
    '2) Keep context consistent across turns (pronouns, terms, tone, references).',
    '3) Preserve meaning faithfully; do not add explanations or extra content.',
    '4) Keep proper nouns, numbers, and code as-is unless a standard translation is obvious.',
    '5) Output translation text only.',
  ].join('\n')
}

export function toRequestSession(config: AppConfig): RequestSession {
  const effectiveTurnDetectionType =
    config.asrModel === 'azure-speech' ? 'azure_semantic_vad' : config.turnDetectionType

  const turnDetection: TurnDetectionUnion =
    effectiveTurnDetectionType === 'server_vad'
      ? {
          type: 'server_vad',
          threshold: config.threshold,
          prefixPaddingInMs: config.prefixPaddingInMs,
          silenceDurationInMs: config.silenceDurationInMs,
          createResponse: true,
          interruptResponse: false,
        }
      : {
          type: 'azure_semantic_vad',
          threshold: config.threshold,
          prefixPaddingInMs: config.prefixPaddingInMs,
          silenceDurationInMs: config.silenceDurationInMs,
          speechDurationInMs: config.speechDurationInMs,
          removeFillerWords: config.removeFillerWords,
          endOfUtteranceDetection: {
            model: config.eouModel,
            thresholdLevel: config.eouThresholdLevel,
            timeoutInMs: config.eouTimeoutInMs,
          },
          createResponse: true,
          interruptResponse: false,
        }


  const asrLanguages = config.asrLanguages
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',')

  return {
    model: config.model,
    modalities: ['audio', 'text'],
    instructions: config.prompt,
    inputAudioFormat: 'pcm16',
    inputAudioSamplingRate: 16000,
    outputAudioFormat: 'pcm16',
    turnDetection,
    inputAudioTranscription:
      config.asrModel === 'azure-speech'
        ? {
            model: 'azure-speech',
            language: asrLanguages || undefined,
          }
        : {
            model: config.asrModel,
          },
    voice:
      config.voiceProvider === 'openai'
        ? {
            type: 'openai',
            name: config.voiceName as any,
          }
        : {
            type: 'azure-standard',
            name: config.voiceName,
          },
  }
}

export function inferPcmSampleRateFromOutputFormat(outputAudioFormat: string | undefined): number {
  // VoiceLive defaults:
  // - pcm16 (no suffix) is 24kHz
  // - pcm16-16000hz / pcm16-8000hz are explicit
  if (!outputAudioFormat) return 24000
  const fmt = outputAudioFormat.toLowerCase()
  if (fmt === 'pcm16') return 24000
  if (fmt === 'pcm16-16000hz') return 16000
  if (fmt === 'pcm16-8000hz') return 8000
  // Non-PCM formats: keep a safe default for duration estimates/playback
  return 24000
}
