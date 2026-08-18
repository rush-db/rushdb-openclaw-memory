# @rushdb/openclaw-memory

Additive, lifecycle-aware [RushDB](https://rushdb.com) memory for [OpenClaw](https://openclaw.ai).

The plugin recalls scope-authorized historical context before inference and durably captures successful completed turns. OpenClaw's local Markdown and SQLite memory remain active.

## Requirements

- Node.js 22.14 or newer
- OpenClaw 2026.8.1-beta.2 or newer
- A RushDB project API key from [app.rushdb.com](https://app.rushdb.com)

## Install

```bash
openclaw plugins install @rushdb/openclaw-memory
```

Set the API key in the OpenClaw gateway environment:

```bash
export RUSHDB_API_KEY="your-project-api-key"
```

Optionally set `RUSHDB_API_URL` for self-hosted RushDB and `RUSHDB_MEMORY_SCOPE_SALT` to make participant hashes deployment-specific.

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
