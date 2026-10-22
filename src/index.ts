import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry'
import { registerRushDBMemory } from './plugin.js'

export { registerRushDBMemory } from './plugin.js'

export default definePluginEntry({
  id: 'rushdb-memory',
  name: 'RushDB Memory',
  description: 'Additive lifecycle-aware persistent memory backed by RushDB',
  register(api) {
    registerRushDBMemory(api)
  }
})
