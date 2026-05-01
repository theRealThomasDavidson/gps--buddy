import type { IVoiceGuidance, VoiceSpeakOptions } from './IVoiceGuidance'

function canUseSpeechSynthesis(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  )
}

export class WebSpeechVoiceGuidance implements IVoiceGuidance {
  isSupported(): boolean {
    return canUseSpeechSynthesis()
  }

  speak(text: string, options: VoiceSpeakOptions = {}): void {
    if (!canUseSpeechSynthesis()) return
    const trimmed = text.trim()
    if (!trimmed) return

    const synth = window.speechSynthesis
    if (options.mode !== 'queue') {
      // Replace mode: ensure we don't build up a backlog of stale navigation prompts.
      synth.cancel()
    }
    const utt = new window.SpeechSynthesisUtterance(trimmed)
    synth.speak(utt)
  }

  stop(): void {
    if (!canUseSpeechSynthesis()) return
    window.speechSynthesis.cancel()
  }
}
