import type { OpenClawHookScopeContext } from './scope.js'

function entryChatTypes(
  entry: unknown,
  sessionDeliveryOrigin: (entry: never) => { chatType?: string } | undefined
): string[] {
  if (!entry || typeof entry !== 'object') return []
  const direct = (entry as { chatType?: unknown }).chatType
  const origin = sessionDeliveryOrigin(entry as never)
  return [direct, origin?.chatType].filter((value): value is string => typeof value === 'string')
}

export async function hostAuthorizesPrivateConversation(ctx: OpenClawHookScopeContext): Promise<boolean> {
  if (!ctx.channel) return true
  const sessionKey = ctx.sessionKey?.trim()
  const agentId = ctx.agentId?.trim()
  if (!sessionKey || !agentId) return false

  try {
    const { getSessionEntry, listSessionEntries, sessionDeliveryOrigin } = await import(
      'openclaw/plugin-sdk/session-store-runtime'
    )
    const entry = getSessionEntry({ agentId, sessionKey, readConsistency: 'latest' })
    const chatTypes = entryChatTypes(entry, sessionDeliveryOrigin)
    if (chatTypes.length === 0 || chatTypes.some((type) => type !== 'direct')) return false

    const sessionId = entry?.sessionId?.trim()
    if (!sessionId) return false
    const aliases = listSessionEntries({ agentId, readOnly: true }).filter(
      ({ entry: candidate }) => candidate.sessionId?.trim() === sessionId
    )
    return aliases.every(({ entry: candidate }) =>
      entryChatTypes(candidate, sessionDeliveryOrigin).every((type) => type === 'direct')
    )
  } catch {
    return false
  }
}
