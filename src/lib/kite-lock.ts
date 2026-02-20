// In-process async mutex for Kite API access.
// Ensures screener refresh and price updates never run concurrently,
// preventing Kite Connect API rate limit breaches.

let _locked = false;
let _lockedBy: string | null = null;
let _lockedAt: number | null = null;
const _waitQueue: Array<() => void> = [];

/**
 * Acquire the Kite API lock. If already held, waits until released
 * or times out. Returns true if lock acquired, false if timed out.
 */
export async function acquireKiteLock(
  caller: string,
  timeoutMs = 300_000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (_locked) {
    if (Date.now() >= deadline) {
      console.warn(
        `[KiteLock] ${caller} timed out waiting for lock held by ${_lockedBy}`
      );
      return false;
    }

    // Auto-expire stale locks (safety net for crashed handlers)
    if (_lockedAt && Date.now() - _lockedAt > 600_000) {
      console.warn(
        `[KiteLock] Force-releasing stale lock held by ${_lockedBy} for ${Math.round((Date.now() - _lockedAt) / 1000)}s`
      );
      releaseKiteLock();
      continue;
    }

    // Wait for current holder to release
    await new Promise<void>((resolve) => {
      _waitQueue.push(resolve);
    });
  }

  _locked = true;
  _lockedBy = caller;
  _lockedAt = Date.now();
  console.log(`[KiteLock] Acquired by ${caller}`);
  return true;
}

/**
 * Release the Kite API lock and wake all waiting callers.
 */
export function releaseKiteLock(): void {
  const heldBy = _lockedBy;
  const heldFor = _lockedAt ? Math.round((Date.now() - _lockedAt) / 1000) : 0;
  _locked = false;
  _lockedBy = null;
  _lockedAt = null;
  console.log(`[KiteLock] Released by ${heldBy} (held ${heldFor}s)`);

  // Wake all waiters — they'll re-check the while loop
  while (_waitQueue.length > 0) {
    const resolve = _waitQueue.shift();
    resolve?.();
  }
}

/**
 * Check current lock status (for the /api/prices/status endpoint).
 */
export function getKiteLockStatus(): {
  locked: boolean;
  lockedBy: string | null;
  lockedFor: number | null;
} {
  return {
    locked: _locked,
    lockedBy: _lockedBy,
    lockedFor: _lockedAt ? Math.round((Date.now() - _lockedAt) / 1000) : null,
  };
}
