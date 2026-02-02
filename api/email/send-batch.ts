import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkQuotaForBatch, incrementQuota, DAILY_LIMIT } from './quota'

interface EmailJob {
  rowIndex: number
  to: string
  cc?: string[]
  subject: string
  htmlBody: string
}

interface SendResult {
  rowIndex: number
  email: string
  status: 'success' | 'failed' | 'rate_limited' | 'quota_exceeded' | 'skipped'
  messageId?: string
  error?: string
}

// Convert HTML to plain text for multipart emails
function htmlToPlainText(html: string): string {
  return html
    // Handle links - show URL in parentheses
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    // Handle lists
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    // Handle block elements
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Sleep utility
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Send a single email with retry logic
async function sendEmailWithRetry(
  job: EmailJob,
  session: { user: { email: string }; accessToken: string },
  maxRetries: number = 3
): Promise<SendResult> {
  const plainText = htmlToPlainText(job.htmlBody)

  // Generate unique identifiers
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`
  const domain = session.user.email.split('@')[1] || 'gmail.com'
  const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${domain}>`

  // Build RFC 2822 multipart message with all recommended headers
  const headers = [
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `From: ${session.user.email}`,
    `To: ${job.to}`,
    job.cc?.length ? `Cc: ${job.cc.join(', ')}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(job.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    // Unsubscribe headers for Gmail compliance
    `List-Unsubscribe: <mailto:${session.user.email}?subject=Unsubscribe>`,
    'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    // Prevent auto-replies to bulk mail
    'Precedence: bulk',
  ]
    .filter((h): h is string => h !== null)
    .join('\r\n')

  // Multipart body with plain text and HTML versions
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    plainText,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    job.htmlBody,
    `--${boundary}--`,
  ].join('\r\n')

  const messageParts = headers + '\r\n\r\n' + body

  const encodedMessage = Buffer.from(messageParts)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedMessage }),
      })

      if (response.ok) {
        const result = await response.json()
        return {
          rowIndex: job.rowIndex,
          email: job.to,
          status: 'success',
          messageId: result.id,
        }
      }

      const status = response.status

      // Rate limited - retry with backoff
      if (status === 429) {
        if (attempt < maxRetries - 1) {
          const backoffMs = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
          await sleep(backoffMs)
          continue
        }
        return {
          rowIndex: job.rowIndex,
          email: job.to,
          status: 'rate_limited',
          error: 'Rate limited by Gmail after retries',
        }
      }

      // Quota exceeded - don't retry
      if (status === 403) {
        return {
          rowIndex: job.rowIndex,
          email: job.to,
          status: 'quota_exceeded',
          error: 'Gmail quota exceeded',
        }
      }

      // Auth error - don't retry
      if (status === 401) {
        return {
          rowIndex: job.rowIndex,
          email: job.to,
          status: 'failed',
          error: 'Authentication expired',
        }
      }

      // Other errors - parse and return
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Gmail API error')
    } catch (error) {
      if (attempt === maxRetries - 1) {
        return {
          rowIndex: job.rowIndex,
          email: job.to,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
      // Retry on network errors
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }

  // Should not reach here, but TypeScript wants a return
  return {
    rowIndex: job.rowIndex,
    email: job.to,
    status: 'failed',
    error: 'Max retries exceeded',
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get session
  const sessionCookie = req.cookies?.otto_session
  if (!sessionCookie) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let session
  try {
    session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'))
  } catch {
    return res.status(401).json({ error: 'Invalid session' })
  }

  if (!session.accessToken) {
    return res.status(401).json({ error: 'No access token' })
  }

  const { emails }: { emails: EmailJob[] } = req.body

  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  // Check quota before starting
  const quota = checkQuotaForBatch(session.user.email, emails.length)
  if (!quota.allowed) {
    // If we can send some but not all, warn but continue
    if (quota.canSend > 0) {
      // Will handle partial send below
    } else {
      return res.status(429).json({
        error: `Daily sending limit reached (${DAILY_LIMIT} emails). Try again tomorrow.`,
        quotaExceeded: true,
        remaining: quota.remaining,
      })
    }
  }

  const results: SendResult[] = []
  const BATCH_SIZE = 5
  const BASE_DELAY_MS = 500
  const JITTER_MS = 200

  // Limit to available quota
  const emailsToSend = emails.slice(0, quota.canSend)
  const skippedEmails = emails.slice(quota.canSend)

  // Add skipped emails to results
  for (const email of skippedEmails) {
    results.push({
      rowIndex: email.rowIndex,
      email: email.to,
      status: 'skipped',
      error: 'Daily quota exceeded',
    })
  }

  // Process in batches to avoid rate limits
  for (let i = 0; i < emailsToSend.length; i += BATCH_SIZE) {
    const batch = emailsToSend.slice(i, i + BATCH_SIZE)

    const batchPromises = batch.map((job) => sendEmailWithRetry(job, session))

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Increment quota for successful sends
    const successCount = batchResults.filter((r) => r.status === 'success').length
    if (successCount > 0) {
      incrementQuota(session.user.email, successCount)
    }

    // Rate limiting delay with jitter between batches
    if (i + BATCH_SIZE < emailsToSend.length) {
      const delay = BASE_DELAY_MS + Math.random() * JITTER_MS
      await sleep(delay)
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const failedCount = results.filter((r) => r.status === 'failed').length
  const rateLimitedCount = results.filter((r) => r.status === 'rate_limited').length
  const quotaExceededCount = results.filter((r) => r.status === 'quota_exceeded' || r.status === 'skipped').length

  // Get updated quota
  const updatedQuota = checkQuotaForBatch(session.user.email, 0)

  res.json({
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failedCount,
      rateLimited: rateLimitedCount,
      quotaExceeded: quotaExceededCount,
    },
    quota: {
      remaining: updatedQuota.remaining,
      used: updatedQuota.used,
      limit: DAILY_LIMIT,
    },
  })
}
