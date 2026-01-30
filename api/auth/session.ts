import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sessionCookie = req.cookies?.otto_session

  if (!sessionCookie) {
    return res.json({ user: null })
  }

  try {
    const sessionData = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'))

    // Check if token is expired
    if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
      // Token expired - in production, would refresh here
      return res.json({ user: null })
    }

    return res.json({ user: sessionData.user, accessToken: sessionData.accessToken })
  } catch (error) {
    return res.json({ user: null })
  }
}
