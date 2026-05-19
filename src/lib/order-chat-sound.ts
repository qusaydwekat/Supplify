/** Soft two-tone chime for incoming order chat messages (Web Audio API, no asset files). */

let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new Ctor()
    }
    return sharedCtx
  } catch {
    return null
  }
}

export function isOrderChatSoundMuted(): boolean {
  try {
    return window.localStorage.getItem('supplify-order-chat-sound-muted') === '1'
  } catch {
    return false
  }
}

export function setOrderChatSoundMuted(muted: boolean): void {
  try {
    if (muted) window.localStorage.setItem('supplify-order-chat-sound-muted', '1')
    else window.localStorage.removeItem('supplify-order-chat-sound-muted')
  } catch {
    /* ignore */
  }
}

export function playOrderChatIncomingSound(): void {
  if (typeof window === 'undefined') return
  if (isOrderChatSoundMuted()) return

  const ctx = getAudioContext()
  if (!ctx) return

  const run = () => {
    const duration = 0.065
    const gap = 0.045
    const freqs = [523.25, 698.46] as const
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime)
      const t0 = ctx.currentTime + i * (duration + gap)
      gain.gain.linearRampToValueAtTime(0.11, t0 + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + duration + 0.02)
    })
  }

  void ctx.resume().then(run).catch(() => {})
}
