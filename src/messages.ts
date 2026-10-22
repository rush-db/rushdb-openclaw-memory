import { boundedText } from '@rushdb/agent-memory-contract'

function messageText(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((part): part is { type: string; text: string } =>
      Boolean(
        part &&
          typeof part === 'object' &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
      )
    )
    .map((part) => part.text)
    .join('\n')
}

export function latestConversationPair(
  messages: unknown[]
): { userText: string; assistantText: string } | null {
  let assistantText = ''
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message || typeof message !== 'object') continue
    const role = (message as { role?: unknown }).role
    const text = messageText(message)
    if (role === 'assistant' && !assistantText) {
      assistantText = text
    } else if (role === 'user' && assistantText) {
      const userText = boundedText(text)
      const assistant = boundedText(assistantText)
      return userText && assistant ? { userText, assistantText: assistant } : null
    }
  }
  return null
}
