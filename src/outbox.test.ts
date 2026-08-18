import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createEpisodeEvent, type RushDBAgentMemory } from '@rushdb/agent-memory-contract'
import { DurableEpisodeWriter } from './outbox.js'

function episode() {
  return createEpisodeEvent({
    runtime: 'openclaw',
    agentId: 'main',
    profileId: 'default',
    privacyScope: 'private',
    participantScopeHash: 'participant',
    sandboxEligible: false,
    externalSessionId: 'session-1',
    sourceEventId: 'run-1',
    turnIndex: 0,
    userText: 'Remember this',
    assistantText: 'Stored',
    summary: 'The user asked to remember this.',
    conversationKind: 'direct',
    visibility: 'participant',
    trustClass: 'mixed',
    originClass: 'conversation',
    observedAt: '2026-08-18T00:00:00Z',
    provenance: 'test'
  })
}

describe('DurableEpisodeWriter', () => {
  it('retries a surviving outbox event without requiring a restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rushdb-openclaw-memory-'))
    const memory = {
      rememberRecent: vi.fn((value) => value),
      persistEpisode: vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary outage'))
        .mockRejectedValueOnce(new Error('temporary outage'))
        .mockRejectedValueOnce(new Error('temporary outage'))
        .mockRejectedValueOnce(new Error('temporary outage'))
        .mockResolvedValue(undefined)
    } as unknown as RushDBAgentMemory
    const writer = new DurableEpisodeWriter(directory, memory, vi.fn(), 5)
    const value = episode()

    await writer.start()
    await writer.enqueue(value)
    expect(await writer.flush(3000)).toBe(true)
    expect(memory.persistEpisode).toHaveBeenCalledTimes(5)
    await expect(readFile(join(directory, `${value.eventId}.json`), 'utf8')).rejects.toThrow()
    await writer.stop()
  })
})
