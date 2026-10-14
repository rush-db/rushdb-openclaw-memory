import {
  createOpenAICompatibleEmbedder,
  type OpenAICompatibleEmbedderConfig,
  type RushDBMemoryClientOptions
} from '@rushdb/agent-memory-contract'

export interface OpenClawRushDBMemoryConfig {
  /** RushDB Cloud API key. */
  apiKey: string
  /** RushDB Cloud (or self-hosted platform) API URL. */
  url?: string
  /** A standalone RushDB engine's URL, instead of RushDB Cloud. */
  engineUrl?: string
  engineToken?: string
  /** Tenant on a multitenant standalone engine. */
  engineScope?: string
  /** An OpenAI-compatible embedding provider; required on a standalone engine. */
  embedding?: OpenAICompatibleEmbedderConfig
  /** Set when the embedding settings are incomplete. */
  embeddingError?: string
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

  const text = (key: string, env: string) =>
    (typeof input[key] === 'string' ? (input[key] as string).trim() : '') || process.env[env] || undefined
  const { embedding, embeddingError } = parseEmbedding({
    baseUrl: text('embeddingBaseUrl', 'RUSHDB_EMBEDDING_BASE_URL'),
    apiKey: text('embeddingApiKey', 'RUSHDB_EMBEDDING_API_KEY'),
    model: text('embeddingModel', 'RUSHDB_EMBEDDING_MODEL'),
    dimensions:
      typeof input.embeddingDimensions === 'number' ? input.embeddingDimensions
      : process.env.RUSHDB_EMBEDDING_DIMENSIONS ? Number(process.env.RUSHDB_EMBEDDING_DIMENSIONS)
      : undefined
  })

  return {
    apiKey: (typeof input.apiKey === 'string' ? input.apiKey.trim() : '') || process.env.RUSHDB_API_KEY || '',
    url: (typeof input.url === 'string' ? input.url.trim() : '') || process.env.RUSHDB_API_URL || undefined,
    engineUrl: text('engineUrl', 'RUSHDB_ENGINE_URL'),
    engineToken: text('engineToken', 'RUSHDB_ENGINE_TOKEN'),
    engineScope: text('engineScope', 'RUSHDB_ENGINE_SCOPE'),
    embedding,
    embeddingError,
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

function parseEmbedding(values: {
  baseUrl?: string
  apiKey?: string
  model?: string
  dimensions?: number
}): { embedding?: OpenAICompatibleEmbedderConfig; embeddingError?: string } {
  const { baseUrl, apiKey, model, dimensions } = values
  if (!apiKey && !model && dimensions === undefined) return {}
  if (!apiKey || !model || !Number.isInteger(dimensions) || (dimensions as number) <= 0) {
    return {
      embeddingError:
        'set RUSHDB_EMBEDDING_API_KEY, RUSHDB_EMBEDDING_MODEL and RUSHDB_EMBEDDING_DIMENSIONS (a positive integer) together'
    }
  }
  return { embedding: { baseUrl, apiKey, model, dimensions: dimensions as number } }
}

/**
 * How the plugin connects: to RushDB Cloud with an API key (managed
 * embeddings, or the configured provider), or to a standalone engine, which
 * has no managed embeddings and so needs an embedding provider. Without a
 * usable configuration, the reason the plugin stays disabled.
 */
export function memoryClientOptions(
  config: OpenClawRushDBMemoryConfig
): { options: RushDBMemoryClientOptions } | { disabled: string } {
  if (config.embeddingError) {
    return { disabled: `rushdb-memory: disabled: ${config.embeddingError}` }
  }
  const embedder = config.embedding ? createOpenAICompatibleEmbedder(config.embedding) : undefined
  if (config.engineUrl) {
    if (!config.engineToken) {
      return { disabled: 'rushdb-memory: disabled: RUSHDB_ENGINE_URL needs RUSHDB_ENGINE_TOKEN' }
    }
    if (!embedder) {
      return {
        disabled:
          'rushdb-memory: disabled: a standalone RushDB engine has no managed embeddings; configure an embedding provider (RUSHDB_EMBEDDING_API_KEY, RUSHDB_EMBEDDING_MODEL, RUSHDB_EMBEDDING_DIMENSIONS)'
      }
    }
    return {
      options: {
        engineUrl: config.engineUrl,
        engineToken: config.engineToken,
        scope: config.engineScope,
        embedder,
        recentLimit: 128
      }
    }
  }
  if (config.apiKey) {
    return { options: { apiKey: config.apiKey, url: config.url, embedder, recentLimit: 128 } }
  }
  return {
    disabled:
      'rushdb-memory: disabled until RUSHDB_API_KEY (RushDB Cloud) or RUSHDB_ENGINE_URL and RUSHDB_ENGINE_TOKEN (a standalone engine) is configured'
  }
}
