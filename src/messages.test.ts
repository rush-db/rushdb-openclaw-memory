import { describe, expect, it } from 'vitest'
import { latestConversationPair } from './messages.js'

describe('latestConversationPair', () => {
  it('extracts only the latest user and assistant text pair', () => {
    expect(
      latestConversationPair([
        { role: 'system', content: 'secret system prompt' },
        { role: 'user', content: 'old question' },
        { role: 'assistant', content: 'old answer' },
        { role: 'tool', content: '/private/file.txt' },
        { role: 'user', content: [{ type: 'text', text: 'new question' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'new answer' }] }
      ])
    ).toEqual({ userText: 'new question', assistantText: 'new answer' })
  })
})
