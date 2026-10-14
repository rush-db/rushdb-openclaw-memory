import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry'
import { describe, expect, it, vi } from 'vitest'
import type { AgentMemoryEpisodeV1, RecallOptions, RecalledMemory } from '@rushdb/agent-memory-contract'
import { registerRushDBMemory } from './plugin.js'

function testHarness() {
  const hooks = new Map<string, (...args: any[]) => any>()
  let preparation: ((params: any) => Promise<readonly string[]>) | undefined
  let corpus: any
  const memory = {
    ensureIndexes: vi.fn(async () => undefined),
    recall: vi.fn(
      async (_options: RecallOptions): Promise<RecalledMemory[]> => [
        { id: 'event-1', label: 'EPISODE', text: 'Use TypeScript', score: 0.92 }
      ]
    ),
    getEpisode: vi.fn(async () => null),
    rememberRecent: vi.fn((episode: AgentMemoryEpisodeV1) => episode),
    persistEpisode: vi.fn(async (episode: AgentMemoryEpisodeV1) => episode)
  }
  const writer = {
    start: vi.fn(async () => undefined),
    enqueue: vi.fn(async () => undefined),
    flush: vi.fn(async () => true),
    stop: vi.fn(async () => undefined)
  }
  const api = {
    pluginConfig: { apiKey: 'test', recallTimeoutMs: 1000 },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    resolvePath: (value: string) => value,
    registerService: vi.fn(),
    registerMemoryPromptSupplement: vi.fn(),
    registerMemoryPromptPreparation: vi.fn((value) => {
      preparation = value
    }),
    registerMemoryCorpusSupplement: vi.fn((value) => {
      corpus = value
    }),
    on: vi.fn((name, handler) => hooks.set(name, handler))
  } as unknown as OpenClawPluginApi

  registerRushDBMemory(api, { memory, writer, authorizeConversation: () => true })
  return { api, hooks, memory, writer, getPreparation: () => preparation, getCorpus: () => corpus }
}

const ctx = {
  agentId: 'main',
  sessionKey: 'agent:main:direct:alice',
  channel: 'telegram',
  accountId: 'primary',
  chatId: 'chat-1',
  senderId: 'alice'
}

describe('OpenClaw additive RushDB plugin', () => {
  it('registers additive surfaces without claiming the exclusive memory capability', () => {
    const { api } = testHarness()
    expect(api.registerMemoryCorpusSupplement).toHaveBeenCalledOnce()
    expect(api.registerMemoryPromptSupplement).toHaveBeenCalledOnce()
    expect(api.registerMemoryCapability).toBeUndefined()
  })

  it('injects recalled data only after a non-sandbox authorization signal', async () => {
    const { hooks, getPreparation, memory } = testHarness()
    await getPreparation()?.({
      agentId: 'main',
      agentSessionKey: ctx.sessionKey,
      sandboxed: false,
      availableTools: new Set()
    })
    const result = await hooks.get('before_prompt_build')?.(
      { prompt: 'What did we choose?', messages: [] },
      ctx
    )
    expect(result.prependContext).toContain('Use TypeScript')
    expect(memory.recall).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'main',
        profileId: 'default',
        privacyScope: 'private',
        excludeSessionId: ctx.sessionKey
      })
    )
  })

  it('does not recall in a sandbox', async () => {
    const { hooks, getPreparation, memory } = testHarness()
    await getPreparation()?.({
      agentId: 'main',
      agentSessionKey: ctx.sessionKey,
      sandboxed: true,
      availableTools: new Set()
    })
    const result = await hooks.get('before_prompt_build')?.(
      { prompt: 'What did we choose?', messages: [] },
      ctx
    )
    expect(result).toBeUndefined()
    expect(memory.recall).not.toHaveBeenCalled()
  })

  it('captures one bounded pair through the durable writer', async () => {
    const { hooks, getPreparation, writer } = testHarness()
    await getPreparation()?.({
      agentId: 'main',
      agentSessionKey: ctx.sessionKey,
      sandboxed: false,
      availableTools: new Set()
    })
    await hooks.get('agent_end')?.(
      {
        runId: 'run-1',
        success: true,
        messages: [
          { role: 'system', content: 'do not upload' },
          { role: 'user', content: 'Use TypeScript' },
          { role: 'assistant', content: 'Understood' }
        ]
      },
      ctx
    )
    expect(writer.enqueue).toHaveBeenCalledOnce()
    expect(writer.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: 'openclaw',
        sourceEventId: 'run-1',
        userText: 'Use TypeScript',
        assistantText: 'Understood'
      })
    )
    expect(JSON.stringify(writer.enqueue.mock.calls[0][0])).not.toContain('do not upload')
  })

  it('corpus search refuses sandboxed requests', async () => {
    const { getCorpus, memory } = testHarness()
    const result = await getCorpus().search({
      query: 'secret',
      agentId: 'main',
      agentSessionKey: ctx.sessionKey,
      sandboxed: true
    })
    expect(result).toEqual([])
    expect(memory.recall).not.toHaveBeenCalled()
  })
})
