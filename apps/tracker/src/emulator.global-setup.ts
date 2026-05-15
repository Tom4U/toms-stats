import { spawn, type ChildProcess } from 'node:child_process'
import { createConnection } from 'node:net'
import http from 'node:http'
import path from 'node:path'

const FIRESTORE_PORT = 8090
// Hardcoded to a local loopback URL so SonarCloud does not flag SSRF.
const FIRESTORE_HTTP_HEALTH_URL = 'http://127.0.0.1:8090/'

// ---------------------------------------------------------------------------
// Port helpers
// ---------------------------------------------------------------------------

function checkPort(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    socket.setTimeout(500)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.once('error', () => resolve(false))
  })
}

// After the TCP port accepts connections the Firestore gRPC service may still
// be initialising. Probe the HTTP endpoint so we only proceed once the server
// actually responds (any status code counts — connection refused does not).
function checkHttpReady(): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(FIRESTORE_HTTP_HEALTH_URL, res => {
      res.destroy()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(500, () => { req.destroy(); resolve(false) })
  })
}

async function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await checkPort(port) && await checkHttpReady()) return
    await new Promise<void>(r => setTimeout(r, 500))
  }
  throw new Error(`Firestore emulator not ready after ${timeoutMs}ms`)
}

// Returns true if the port closed within the timeout, false if it lingered.
async function waitForPortClosed(port: number, timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await checkPort(port))) return true
    await new Promise<void>(r => setTimeout(r, 500))
  }
  return false
}

// ---------------------------------------------------------------------------
// Process-tree kill (cross-platform)
// ---------------------------------------------------------------------------

function killTree(pid: number): Promise<void> {
  return new Promise(resolve => {
    if (process.platform === 'win32') {
      // /F = force, /T = tree (all descendants)
      const t = spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' }) // NOSONAR: PATH-resolved taskkill is test-setup only, no user input, Windows process-tree cleanup
      t.once('close', () => resolve())
    } else {
      try {
        process.kill(-pid, 'SIGTERM') // negative PID targets the process group
      } catch {
        // Process may already be gone
      }
      resolve()
    }
  })
}

// ---------------------------------------------------------------------------
// Spawn helper (platform-aware)
// ---------------------------------------------------------------------------

function spawnEmulator(projectRoot: string): ChildProcess {
  if (process.platform === 'win32') {
    // Use cmd.exe with explicit args so argument boundaries are unambiguous
    // and no shell metacharacter expansion can occur. All inputs are
    // hardcoded constants — no user data involved.
    return spawn( // NOSONAR: test-only emulator launch, all args hardcoded, no user input
      'cmd.exe',
      ['/c', 'npx', 'firebase', 'emulators:start', '--only', 'firestore', '--project', 'toms-stats'],
      { cwd: projectRoot, stdio: 'ignore' },
    )
  }
  // Unix: shell:false + detached:true puts the child in its own process group,
  // letting kill(-pid) terminate all descendants at once.
  return spawn( // NOSONAR: test-only emulator launch, all args hardcoded, no user input
    'npx',
    ['firebase', 'emulators:start', '--only', 'firestore', '--project', 'toms-stats'],
    { cwd: projectRoot, stdio: 'ignore', detached: true },
  )
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let managedPid: number | null = null

export async function setup(): Promise<void> {
  if (await checkPort(FIRESTORE_PORT)) return // already running (dev mode)

  // Walk up two levels: apps/tracker → apps → project root
  const projectRoot = path.resolve(process.cwd(), '../..')

  const child = spawnEmulator(projectRoot)
  // unref() so the child does not keep the vitest process alive if teardown is skipped
  child.unref()

  if (child.pid === undefined) throw new Error('Failed to spawn Firebase emulator')
  managedPid = child.pid

  await waitForPort(FIRESTORE_PORT)
}

export async function teardown(): Promise<void> {
  if (managedPid === null) return

  const pid = managedPid
  managedPid = null

  await killTree(pid)

  const closed = await waitForPortClosed(FIRESTORE_PORT)

  // Java emulator sometimes ignores SIGTERM; escalate to SIGKILL so the port
  // is not left open for the next CI run.
  if (!closed && process.platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      // Process may already be gone between the check and the kill
    }
  }
}
