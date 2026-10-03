let sharedCtx: AudioContext | null = null

function getCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { webkitAudioContext?: typeof AudioContext }
  return (window.AudioContext ?? w.webkitAudioContext) ?? null
}

export function getAudioContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx
  const Ctx = getCtor()
  if (!Ctx) return null
  sharedCtx = new Ctx()
  return sharedCtx
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state !== 'running') await ctx.resume()
}
