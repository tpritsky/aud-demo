/** Shared support contact for marketing, auth, and footers */
export const SUPPORT_EMAIL = 'support@vocalis.team'

export const supportMailto = (subject?: string) =>
  `mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
