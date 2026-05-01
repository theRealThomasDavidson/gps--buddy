export type VoiceSpeakMode = 'replace' | 'queue'

export type VoiceSpeakOptions = {
  /**
   * `replace`: cancel any in-progress speech and speak immediately (best for navigation).
   * `queue`: queue behind any in-progress speech.
   */
  mode?: VoiceSpeakMode
}

export interface IVoiceGuidance {
  isSupported(): boolean
  speak(text: string, options?: VoiceSpeakOptions): void
  stop(): void
}
