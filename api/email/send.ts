import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkQuota, incrementQuota, DAILY_LIMIT } from './quota'

interface SendEmailRequest {
  to: string
  cc?: string[]
  subject: string
  htmlBody: string
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

  const { to, cc, subject, htmlBody }: SendEmailRequest = req.body

  if (!to || !subject || !htmlBody) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Check daily quota
  const quota = checkQuota(session.user.email)
  if (!quota.allowed) {
    return res.status(429).json({
      error: `Daily sending limit reached (${DAILY_LIMIT} emails). Try again tomorrow.`,
      quotaExceeded: true,
      remaining: 0,
    })
  }

  try {
    // Generate plain text version from HTML
    const plainText = htmlToPlainText(htmlBody)

    // Generate unique identifiers
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`
    const domain = session.user.email.split('@')[1] || 'gmail.com'
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${domain}>`

    // Build RFC 2822 multipart message with all recommended headers
    const headers = [
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      `From: ${session.user.email}`,
      `To: ${to}`,
      cc?.length ? `Cc: ${cc.join(', ')}` : null,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
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
      htmlBody,
      `--${boundary}--`,
    ].join('\r\n')

    const messageParts = headers + '\r\n\r\n' + body

    // Base64 URL-safe encode
    const encodedMessage = Buffer.from(messageParts)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      const status = response.status

      // Handle specific error types
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate limited by Gmail. Please wait and try again.',
          rateLimited: true,
        })
      } else if (status === 403) {
        return res.status(403).json({
          error: 'Gmail quota exceeded. Try again later.',
          quotaExceeded: true,
        })
      } else if (status === 401) {
        return res.status(401).json({
          error: 'Session expired. Please sign in again.',
          authExpired: true,
        })
      }

      throw new Error(errorData.error?.message || 'Failed to send email')
    }

    // Increment quota on success
    incrementQuota(session.user.email)

    const result = await response.json()

    res.json({
      success: true,
      messageId: result.id,
      quotaRemaining: quota.remaining - 1,
    })
  } catch (error) {
    console.error('Send email error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send email',
    })
  }
}
