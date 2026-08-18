import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type AgentMemoryEpisodeV1, type RushDBAgentMemory } from '@rushdb/agent-memory-contract'

const EVENT_FILE = /^[a-f0-9]{64}\.json$/

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export class DurableEpisodeWriter {
  private readonly pending: string[] = []
  private readonly queued = new Set<string>()
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private active = false
  private stopping = false

  public constructor(
    private readonly directory: string,
    private readonly memory: RushDBAgentMemory,
    private readonly onError: (message: string, error?: unknown) => void,
    private readonly retryDelayMs = 5000
  ) {}

  public async start(): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    for (const filename of await readdir(this.directory)) {
      if (EVENT_FILE.test(filename)) {
        this.queuePath(join(this.directory, filename))
      }
    }
    void this.pump()
  }

  public async enqueue(episode: AgentMemoryEpisodeV1): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    this.memory.rememberRecent(episode)
    const destination = join(this.directory, `${episode.eventId}.json`)
    const temporary = join(this.directory, `.${episode.eventId}.${randomUUID()}.tmp`)
    await writeFile(temporary, JSON.stringify(episode), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, destination)
    const retryTimer = this.retryTimers.get(destination)
    if (retryTimer) {
      clearTimeout(retryTimer)
      this.retryTimers.delete(destination)
    }
    this.queuePath(destination)
    void this.pump()
  }

  public async flush(timeoutMs = 2000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (
      (this.active || this.pending.length > 0 || this.retryTimers.size > 0) &&
      Date.now() < deadline
    ) {
      await delay(20)
    }
    return !this.active && this.pending.length === 0 && this.retryTimers.size === 0
  }

  public async stop(): Promise<void> {
    await this.flush()
    this.stopping = true
    for (const timer of this.retryTimers.values()) clearTimeout(timer)
    this.retryTimers.clear()
  }

  private queuePath(path: string): void {
    if (this.queued.has(path)) return
    this.queued.add(path)
    this.pending.push(path)
  }

  private async pump(): Promise<void> {
    if (this.active || this.stopping) return
    this.active = true
    try {
      while (!this.stopping) {
        const path = this.pending.shift()
        if (!path) break
        try {
          const episode = JSON.parse(await readFile(path, 'utf8')) as AgentMemoryEpisodeV1
          await this.persistWithRetry(episode)
          await unlink(path)
        } catch (error) {
          this.onError(`RushDB memory write failed; ${path} remains in the outbox`, error)
          this.scheduleRetry(path)
        } finally {
          this.queued.delete(path)
        }
      }
    } finally {
      this.active = false
    }
  }

  private scheduleRetry(path: string): void {
    if (this.stopping || this.retryTimers.has(path)) return
    const timer = setTimeout(() => {
      this.retryTimers.delete(path)
      if (this.stopping) return
      this.queuePath(path)
      void this.pump()
    }, this.retryDelayMs)
    this.retryTimers.set(path, timer)
  }

  private async persistWithRetry(episode: AgentMemoryEpisodeV1): Promise<void> {
    let lastError: unknown
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await this.memory.persistEpisode(episode)
        return
      } catch (error) {
        lastError = error
        if (attempt < 3) await delay(250 * 2 ** attempt)
      }
    }
    throw lastError
  }
}
