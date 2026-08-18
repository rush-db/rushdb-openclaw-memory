import { hashScope, type MemoryScope } from '@rushdb/agent-memory-contract'

export interface OpenClawHookScopeContext {
  agentId?: string
  sessionKey?: string
  sessionId?: string
  channel?: string
  accountId?: string
  chatId?: string
  senderId?: string
}

export interface AuthorizedOpenClawScope extends MemoryScope {
  externalSessionId: string
  conversationKind: 'direct' | 'local'
  channelIdHash?: string
}

const SHARED_OR_AUTOMATION_KEY = /:(?:group|channel|active-memory|cron|heartbeat|hook|node|subagent)(?::|$)/i

export function resolveAuthorizedScope(
  ctx: OpenClawHookScopeContext,
  options: {
    profileId: string
    scopeSalt?: string
    localScopeId?: string
    sandboxed: boolean
  }
): AuthorizedOpenClawScope | null {
  const agentId = ctx.agentId?.trim()
  const sessionKey = ctx.sessionKey?.trim()
  const externalSessionId = sessionKey || ctx.sessionId?.trim()
  if (!agentId || !externalSessionId || options.sandboxed) return null

  const normalizedKey = externalSessionId.toLocaleLowerCase()
  if (
    normalizedKey === 'global' ||
    normalizedKey === 'unknown' ||
    normalizedKey.includes(':incognito:') ||
    SHARED_OR_AUTOMATION_KEY.test(normalizedKey)
  ) {
    return null
  }

  const salt = options.scopeSalt ?? ''
  const channel = ctx.channel?.trim()
  if (channel) {
    const participant = ctx.senderId?.trim() || ctx.chatId?.trim()
    if (!participant) return null
    return {
      agentId,
      profileId: options.profileId,
      privacyScope: 'private',
      participantScopeHash: hashScope([channel, ctx.accountId ?? 'default', participant], salt),
      sandboxEligible: false,
      externalSessionId,
      conversationKind: 'direct',
      channelIdHash: hashScope([channel, ctx.accountId, ctx.chatId], salt)
    }
  }

  const localIdentity = options.localScopeId?.trim() || externalSessionId
  return {
    agentId,
    profileId: options.profileId,
    privacyScope: 'private',
    participantScopeHash: hashScope(['local', localIdentity], salt),
    sandboxEligible: false,
    externalSessionId,
    conversationKind: 'local'
  }
}
