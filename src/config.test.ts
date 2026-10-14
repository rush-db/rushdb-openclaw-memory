import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryClientOptions, parseConfig } from './config.js'

const embedding = { embeddingApiKey: 'key', embeddingModel: 'text-embedding-3-small', embeddingDimensions: 1536 }

describe('memoryClientOptions', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('connects to RushDB Cloud with an API key', () => {
    const result = memoryClientOptions(parseConfig({ apiKey: 'cloud-key' }))
    expect(result).toMatchObject({ options: { apiKey: 'cloud-key' } })
    expect('options' in result && result.options.embedder).toBeUndefined()
  })

  it('connects to a standalone engine with an embedding provider', () => {
    const result = memoryClientOptions(
      parseConfig({ engineUrl: 'http://127.0.0.1:3000', engineToken: 'engine', engineScope: 't1', ...embedding })
    )
    expect(result).toMatchObject({
      options: { engineUrl: 'http://127.0.0.1:3000', engineToken: 'engine', scope: 't1' }
    })
    expect('options' in result && result.options.embedder?.dimensions).toBe(1536)
  })

  it('reads the standalone settings from the environment', () => {
    vi.stubEnv('RUSHDB_ENGINE_URL', 'http://engine:3000')
    vi.stubEnv('RUSHDB_ENGINE_TOKEN', 'engine')
    vi.stubEnv('RUSHDB_EMBEDDING_API_KEY', 'key')
    vi.stubEnv('RUSHDB_EMBEDDING_MODEL', 'm')
    vi.stubEnv('RUSHDB_EMBEDDING_DIMENSIONS', '8')
    const result = memoryClientOptions(parseConfig({}))
    expect('options' in result && result.options.engineUrl).toBe('http://engine:3000')
    expect('options' in result && result.options.embedder?.dimensions).toBe(8)
  })

  it('stays disabled, saying why, when a standalone engine has no embedding provider', () => {
    const result = memoryClientOptions(parseConfig({ engineUrl: 'http://127.0.0.1:3000', engineToken: 'engine' }))
    expect(result).toMatchObject({ disabled: expect.stringContaining('no managed embeddings') })
  })

  it('stays disabled on incomplete embedding settings or no connection at all', () => {
    expect(memoryClientOptions(parseConfig({ apiKey: 'k', embeddingModel: 'm' }))).toMatchObject({
      disabled: expect.stringContaining('RUSHDB_EMBEDDING_DIMENSIONS')
    })
    expect(memoryClientOptions(parseConfig({ engineUrl: 'http://e', ...embedding }))).toMatchObject({
      disabled: expect.stringContaining('RUSHDB_ENGINE_TOKEN')
    })
    vi.stubEnv('RUSHDB_API_KEY', '')
    expect(memoryClientOptions(parseConfig({}))).toMatchObject({
      disabled: expect.stringContaining('RUSHDB_API_KEY')
    })
  })
})
