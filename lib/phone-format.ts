/**
 * Normalize phone number to E.164 format for Eleven Labs API
 * E.164 format: +[country code][number] (e.g., +15596729884)
 * Returns format: +15596729884 (no spaces, no formatting)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return ''

  // Remove all non-digit characters except +, but handle multiple + signs
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // Remove duplicate + signs (e.g., ++1559 -> +1559)
  cleaned = cleaned.replace(/\++/g, '+')
  
  // If it starts with multiple +, keep only one
  if (cleaned.startsWith('++')) {
    cleaned = '+' + cleaned.substring(2)
  }

  // If it starts with +1, check if it's valid
  if (cleaned.startsWith('+1')) {
    const digits = cleaned.substring(2)
    // Must be exactly 10 digits after +1
    if (digits.length === 10) {
      return '+1' + digits
    }
    // If it has more digits, truncate to 10
    if (digits.length > 10) {
      return '+1' + digits.substring(0, 10)
    }
  }

  // If it starts with + but not +1, keep as is (international)
  if (cleaned.startsWith('+') && !cleaned.startsWith('+1')) {
    return cleaned
  }

  // If it starts with 1 and is 11 digits, add +
  if (cleaned.startsWith('1') && cleaned.length === 11 && !cleaned.startsWith('+')) {
    return '+' + cleaned
  }

  // If it's exactly 10 digits, assume US number and add +1
  if (cleaned.length === 10 && !cleaned.startsWith('+')) {
    return '+1' + cleaned
  }

  // If it's already in E.164 format (+1 + 10 digits = 12 chars), return as is
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return cleaned
  }

  // If we have 11 digits starting with 1, convert to +1 format
  if (cleaned.length === 11 && cleaned.startsWith('1') && !cleaned.startsWith('+')) {
    return '+1' + cleaned.substring(1)
  }

  // Last resort: try to extract 10 digits and add +1
  const digitsOnly = cleaned.replace(/\+/g, '')
  if (digitsOnly.length >= 10) {
    // Take last 10 digits (in case there's a leading 1)
    const last10 = digitsOnly.slice(-10)
    return '+1' + last10
  }

  // Return cleaned version (may not be valid, but best effort)
  // Ensure we don't add + if one already exists
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  return '+1' + cleaned
}

/**
 * Format phone number for display (e.g., +1 (559) 672-9884)
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return ''

  const normalized = normalizePhoneNumber(phone)
  
  // If it's a US number (+1XXXXXXXXXX)
  if (normalized.startsWith('+1') && normalized.length === 12) {
    const areaCode = normalized.substring(2, 5)
    const firstPart = normalized.substring(5, 8)
    const lastPart = normalized.substring(8, 12)
    return `+1 (${areaCode}) ${firstPart}-${lastPart}`
  }

  // For international numbers, return as is
  return normalized
}

/**
 * Format phone number as user types (real-time formatting)
 * Allows partial input and formats as they type
 */
export function formatPhoneInput(value: string): string {
  if (!value) return ''

  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')

  // If empty, return empty
  if (digits.length === 0) return ''

  // If starts with +, keep it
  const hasPlus = value.startsWith('+')
  
  // Limit to 11 digits (1 + 10 for US numbers)
  const limitedDigits = digits.slice(0, 11)

  // Format based on length
  if (limitedDigits.length <= 1) {
    return hasPlus ? '+' + limitedDigits : limitedDigits
  } else if (limitedDigits.length <= 4) {
    // +1 or +1559
    return hasPlus ? '+' + limitedDigits : limitedDigits
  } else if (limitedDigits.length <= 7) {
    // +1 (559) 672
    const areaCode = limitedDigits.slice(1, 4)
    const firstPart = limitedDigits.slice(4)
    return hasPlus 
      ? `+1 (${areaCode}) ${firstPart}`
      : `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`
  } else {
    // +1 (559) 672-9884
    const areaCode = limitedDigits.slice(1, 4)
    const firstPart = limitedDigits.slice(4, 7)
    const lastPart = limitedDigits.slice(7, 11)
    return hasPlus
      ? `+1 (${areaCode}) ${firstPart}-${lastPart}`
      : `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6, 10)}`
  }
}

/**
 * Handle phone input change - formats display but stores normalized value
 */
export function handlePhoneInputChange(
  value: string,
  setDisplayValue: (value: string) => void,
  setNormalizedValue: (value: string) => void
) {
  // Format for display
  const formatted = formatPhoneInput(value)
  setDisplayValue(formatted)
  
  // Store normalized version
  const normalized = normalizePhoneNumber(value)
  setNormalizedValue(normalized)
}

