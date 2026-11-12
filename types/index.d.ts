export type Status = 'idle' | 'thinking' | 'speaking'

declare module 'claude-code' {
  interface PluginState {
    'catch-me-up': { status: Status; last: string | null }
  }
}
