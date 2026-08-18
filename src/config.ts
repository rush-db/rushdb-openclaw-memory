export interface OpenClawRushDBMemoryConfig {
  apiKey: string
  url?: string
  profileId: string
  scopeSalt: string
  localScopeId?: string
  outboxPath: string
  autoRecall: boolean
  autoCapture: boolean
  recallTimeoutMs: number
}

export function parseConfig(value: Record<string, unknown> | undefined): OpenClawRushDBMemoryConfig {
  const input = value ?? {}
  const numberValue = input.recallTimeoutMs
  const recallTimeoutMs =
    typeof numberValue === 'number' && Number.isInteger(numberValue) ?
      Math.max(50, Math.min(numberValue, 30_000))
    : 300

  return {
    apiKey: (typeof input.apiKey === 'string' ? input.apiKey.trim() : '') || process.env.RUSHDB_API_KEY || '',
    url: (typeof input.url === 'string' ? input.url.trim() : '') || process.env.RUSHDB_API_URL || undefined,
    profileId: (typeof input.profileId === 'string' ? input.profileId.trim() : '') || 'default',
    scopeSalt:
      (typeof input.scopeSalt === 'string' ? input.scopeSalt : '') ||
      process.env.RUSHDB_MEMORY_SCOPE_SALT ||
      '',
    localScopeId:
      typeof input.localScopeId === 'string' && input.localScopeId.trim() ?
        input.localScopeId.trim()
      : undefined,
    outboxPath:
      (typeof input.outboxPath === 'string' ? input.outboxPath.trim() : '') ||
      '~/.openclaw/rushdb-memory/outbox',
    autoRecall: input.autoRecall !== false,
    autoCapture: input.autoCapture !== false,
    recallTimeoutMs
  }
}
