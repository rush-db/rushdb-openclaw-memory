import { describe, expect, it } from 'vitest'
import { resolveAuthorizedScope } from './scope.js'

const options = { profileId: 'default', scopeSalt: 'test', sandboxed: false }

describe('OpenClaw protected memory scope', () => {
  it('authorizes a direct channel participant with a stable hash', () => {
    const scope = resolveAuthorizedScope(
      {
        agentId: 'main',
        sessionKey: 'agent:main:direct:alice',
        channel: 'telegram',
        accountId: 'primary',
        chatId: 'chat-1',
        senderId: 'alice'
      },
      options
    )
    expect(scope?.conversationKind).toBe('direct')
    expect(scope?.participantScopeHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it.each([
    'global',
    'unknown',
    'agent:main:telegram:group:42',
    'agent:main:discord:channel:42',
    'agent:main:subagent:child',
    'agent:main:cron:nightly'
  ])('fails closed for shared or automation session %s', (sessionKey) => {
    expect(resolveAuthorizedScope({ agentId: 'main', sessionKey }, options)).toBeNull()
  })

  it('fails closed in sandboxed contexts', () => {
    expect(
      resolveAuthorizedScope(
        { agentId: 'main', sessionKey: 'agent:main:direct:alice' },
        { ...options, sandboxed: true }
      )
    ).toBeNull()
  })
})
