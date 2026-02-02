/**
 * Check email content for common spam triggers.
 * These are heuristics based on common spam filter rules.
 */

export interface SpamWarning {
  type: 'high' | 'medium' | 'low'
  message: string
}

// Words that commonly trigger spam filters
const SPAM_TRIGGER_WORDS = [
  // Urgency
  'act now',
  'limited time',
  'urgent',
  'immediate',
  'expires',
  'hurry',
  'don\'t miss',
  'last chance',
  // Financial
  'free',
  'winner',
  'cash',
  'prize',
  'lottery',
  'credit card',
  'investment',
  'earn money',
  'make money',
  'income',
  // Sales pressure
  'buy now',
  'order now',
  'click here',
  'subscribe',
  'unsubscribe',
  'special offer',
  'discount',
  'cheap',
  'bargain',
  // Suspicious
  'no obligation',
  'risk free',
  'guarantee',
  'no questions asked',
  'confidential',
  'private',
]

/**
 * Check subject and body for spam triggers
 */
export function checkForSpamTriggers(subject: string, body: string): SpamWarning[] {
  const warnings: SpamWarning[] = []
  const combinedText = `${subject} ${body}`.toLowerCase()
  const subjectLower = subject.toLowerCase()

  // Check for ALL CAPS in subject (more than 5 consecutive caps)
  if (/[A-Z]{5,}/.test(subject)) {
    warnings.push({
      type: 'high',
      message: 'Subject contains words in ALL CAPS - this often triggers spam filters',
    })
  }

  // Check for excessive exclamation marks
  const exclamationCount = (subject + body).match(/!/g)?.length || 0
  if (exclamationCount > 3) {
    warnings.push({
      type: 'medium',
      message: `Contains ${exclamationCount} exclamation marks - excessive punctuation can trigger spam filters`,
    })
  }

  // Check for multiple question marks
  if (/\?{2,}/.test(subject + body)) {
    warnings.push({
      type: 'low',
      message: 'Contains multiple question marks in a row',
    })
  }

  // Check for spam trigger words in subject (more severe)
  const subjectTriggers = SPAM_TRIGGER_WORDS.filter((word) => subjectLower.includes(word))
  if (subjectTriggers.length > 0) {
    warnings.push({
      type: 'high',
      message: `Subject contains spam trigger words: "${subjectTriggers.slice(0, 3).join('", "')}"${subjectTriggers.length > 3 ? '...' : ''}`,
    })
  }

  // Check for spam trigger words in body (less severe)
  const bodyTriggers = SPAM_TRIGGER_WORDS.filter(
    (word) => combinedText.includes(word) && !subjectLower.includes(word)
  )
  if (bodyTriggers.length > 2) {
    warnings.push({
      type: 'medium',
      message: `Body contains multiple spam trigger words: "${bodyTriggers.slice(0, 3).join('", "')}"`,
    })
  }

  // Check for dollar signs with amounts (common in spam)
  const dollarMatches = (subject + body).match(/\$\d+/g)
  if (dollarMatches && dollarMatches.length > 2) {
    warnings.push({
      type: 'medium',
      message: 'Contains multiple dollar amounts - common in spam',
    })
  }

  // Check for percentage claims
  if (/\d{2,3}%\s*(off|discount|free|guarantee)/i.test(combinedText)) {
    warnings.push({
      type: 'medium',
      message: 'Contains percentage discount claims',
    })
  }

  // Check if subject is all caps
  if (subject.length > 10 && subject === subject.toUpperCase() && /[A-Z]/.test(subject)) {
    warnings.push({
      type: 'high',
      message: 'Entire subject is in ALL CAPS',
    })
  }

  // Check for suspicious phrases
  if (/re:|fwd:/i.test(subject) && !body.includes('On ') && !body.includes('wrote:')) {
    warnings.push({
      type: 'low',
      message: 'Subject starts with Re:/Fwd: but email doesn\'t appear to be a reply',
    })
  }

  return warnings
}

/**
 * Get overall spam risk level
 */
export function getSpamRiskLevel(warnings: SpamWarning[]): 'low' | 'medium' | 'high' | 'none' {
  if (warnings.length === 0) return 'none'

  const hasHigh = warnings.some((w) => w.type === 'high')
  const mediumCount = warnings.filter((w) => w.type === 'medium').length

  if (hasHigh || mediumCount >= 2) return 'high'
  if (mediumCount >= 1) return 'medium'
  return 'low'
}

/**
 * Get a summary message for the spam risk
 */
export function getSpamRiskSummary(warnings: SpamWarning[]): string {
  const level = getSpamRiskLevel(warnings)

  switch (level) {
    case 'none':
      return 'No spam issues detected'
    case 'low':
      return 'Minor spam concerns - should be fine'
    case 'medium':
      return 'Some spam triggers detected - review suggested'
    case 'high':
      return 'High spam risk - emails may go to spam folder'
  }
}
