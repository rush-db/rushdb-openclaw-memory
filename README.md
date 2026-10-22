# @rushdb/openclaw-memory

Additive, lifecycle-aware [RushDB](https://rushdb.com) memory for [OpenClaw](https://openclaw.ai).

The plugin recalls scope-authorized historical context before inference and durably captures successful completed turns. OpenClaw's local Markdown and SQLite memory remain active.

## Requirements

- Node.js 22.14 or newer
- OpenClaw 2026.8.1-beta.2 or newer
- A RushDB project API key from [app.rushdb.com](https://app.rushdb.com), or a standalone RushDB
  engine and an embedding provider (see below)

## Install

```bash
openclaw plugins install @rushdb/openclaw-memory
```

Set the API key in the OpenClaw gateway environment:

```bash
export RUSHDB_API_KEY="your-project-api-key"
```

Optionally set `RUSHDB_API_URL` to use a different RushDB Cloud API endpoint and `RUSHDB_MEMORY_SCOPE_SALT` to make participant hashes deployment-specific.

### A standalone RushDB engine

Memory recall is a vector search. RushDB Cloud embeds memories for you; a standalone engine
(`rushdbd`) does not, so give the plugin an OpenAI-compatible embedding provider:

```bash
export RUSHDB_ENGINE_URL="http://127.0.0.1:3000"
export RUSHDB_ENGINE_TOKEN="your-engine-token"
# export RUSHDB_ENGINE_SCOPE="tenant-1"   # only for an engine started with --multitenant
export RUSHDB_EMBEDDING_API_KEY="sk-..."
export RUSHDB_EMBEDDING_MODEL="text-embedding-3-small"
export RUSHDB_EMBEDDING_DIMENSIONS="1536"
# export RUSHDB_EMBEDDING_BASE_URL="https://api.openai.com/v1"   # any OpenAI-compatible endpoint
```

The same settings are accepted in the plugin config (`engineUrl`, `engineToken`, `engineScope`,
`embeddingBaseUrl`, `embeddingApiKey`, `embeddingModel`, `embeddingDimensions`). With RushDB Cloud the
embedding settings are optional: set them to embed on your side instead of with the managed model.
Without a usable configuration the plugin stays disabled and logs why.

## Configure

The defaults enable automatic recall and capture. Optional plugin configuration:

```json
{
  "plugins": {
    "entries": {
      "rushdb-memory": {
        "enabled": true,
        "config": {
          "profileId": "default",
          "localScopeId": "optional-stable-local-profile",
          "autoRecall": true,
          "autoCapture": true,
          "recallTimeoutMs": 300
        }
      }
    }
  }
}
```

For local/CLI conversations, set `localScopeId` when multiple sessions should share one private participant scope. Channel conversations derive participant scope from host session metadata.

## Safety and durability

- Only host-authorized direct/private or eligible local conversations are captured.
- Sandboxed, group, channel, automation, and subagent session keys fail closed.
- Only the latest successful user/assistant pair is persisted; system prompts, tool transcripts, command output, secrets, and local paths are not automatically uploaded.
- Recall has a short fail-open timeout, so RushDB availability never blocks the OpenClaw reply.
- Writes first enter a mode-`0600` local outbox under `~/.openclaw/rushdb-memory/outbox` and use deterministic IDs plus idempotent RushDB upserts.
- Recalled records are injected as untrusted historical context, never as instructions or policy.

The plugin automatically projects completed turns to `EPISODE`. It does not replace OpenClaw's explicit local memory-write path or expose a model-callable canonical fact writer.

## Development

```bash
pnpm install
pnpm check
npm pack --dry-run
```

The provider-neutral AgentMemoryEvent v1 implementation is supplied by
`@rushdb/agent-memory-contract`.

## Release

CI verifies pull requests and every push to `main`. A successful `main` build publishes the version in `package.json` to npm when that exact version is not already present. Configure the repository secret `NPM_TOKEN` with publish access to the `@rushdb` scope. Bump `version` before merging a subsequent release.

## License

Apache-2.0
