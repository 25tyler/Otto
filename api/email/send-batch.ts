import type { VercelRequest, VercelResponse } from '@vercel/node'

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
  status: 'success' | 'failed'
  messageId?: string
  error?: string
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

  const results: SendResult[] = []
  const BATCH_SIZE = 5
  const DELAY_MS = 500 // Rate limiting

  // Process in batches to avoid rate limits
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)

    const batchPromises = batch.map(async (job) => {
      try {
        // Build RFC 2822 message
        const messageParts = [
          `From: ${session.user.email}`,
          `To: ${job.to}`,
          job.cc?.length ? `Cc: ${job.cc.join(', ')}` : '',
          `Subject: =?UTF-8?B?${Buffer.from(job.subject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          '',
          job.htmlBody,
        ]
          .filter(Boolean)
          .join('\r\n')

        const encodedMessage = Buffer.from(messageParts)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')

        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: encodedMessage }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error?.message || 'Gmail API error')
        }

        const result = await response.json()

        return {
          rowIndex: job.rowIndex,
          email: job.to,
          status: 'success' as const,
          messageId: result.id,
        }
      } catch (error) {
        return {
          rowIndex: job.rowIndex,
          email: job.to,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  res.json({
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failedCount,
    },
  })
}
