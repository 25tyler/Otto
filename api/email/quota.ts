/**
 * Simple in-memory quota tracking for Gmail API rate limits.
 *
 * Gmail limits:
 * - Regular Gmail: 500 emails/day (we use 250 to be safe)
 * - Google Workspace: Higher limits based on plan
 *
 * Note: This is in-memory and resets on server restart.
 * For production, use Redis or a database.
 */

export const DAILY_LIMIT = 250

interface QuotaEntry {
  count: number
  date: string // YYYY-MM-DD format
}

// In-memory storage (resets on server restart)
const quotaMap = new Map<string, QuotaEntry>()

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Check if user can send more emails today
 */
export function checkQuota(userEmail: string): { allowed: boolean; remaining: number; used: number } {
  const today = getTodayDate()
  const entry = quotaMap.get(userEmail)

  // No entry or entry from different day = full quota available
  if (!entry || entry.date !== today) {
    return {
      allowed: true,
      remaining: DAILY_LIMIT,
      used: 0,
    }
  }

  const remaining = Math.max(0, DAILY_LIMIT - entry.count)

  return {
    allowed: remaining > 0,
    remaining,
    used: entry.count,
  }
}

/**
 * Check quota for sending multiple emails at once
 */
export function checkQuotaForBatch(
  userEmail: string,
  count: number
): { allowed: boolean; remaining: number; used: number; canSend: number } {
  const quota = checkQuota(userEmail)

  return {
    ...quota,
    allowed: quota.remaining >= count,
    canSend: Math.min(count, quota.remaining),
  }
}

/**
 * Increment the quota counter after successful send
 */
export function incrementQuota(userEmail: string, count: number = 1): void {
  const today = getTodayDate()
  const entry = quotaMap.get(userEmail)

  if (!entry || entry.date !== today) {
    // New day or new user
    quotaMap.set(userEmail, { count, date: today })
  } else {
    // Same day, increment count
    entry.count += count
  }
}

/**
 * Get quota status for display purposes
 */
export function getQuotaStatus(userEmail: string): {
  used: number
  remaining: number
  limit: number
  percentUsed: number
} {
  const { used, remaining } = checkQuota(userEmail)

  return {
    used,
    remaining,
    limit: DAILY_LIMIT,
    percentUsed: Math.round((used / DAILY_LIMIT) * 100),
  }
}
