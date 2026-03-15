/**
 * Shared name formatting utilities
 * All student/teacher name displays use these functions
 */

/** Full name: "Juan D. Dela Cruz" */
export const fullName = (first, middle, last) => {
  if (!first && !last) return ''
  const mi = middle ? ' ' + middle[0].toUpperCase() + '.' : ''
  return (first || '') + mi + ' ' + (last || '')
}

/** Formal: "Dela Cruz, Juan D." — for lists and dropdowns */
export const formalName = (first, middle, last) => {
  if (!first && !last) return ''
  const mi = middle ? ' ' + middle[0].toUpperCase() + '.' : ''
  return (last || '') + ', ' + (first || '') + mi
}

/** Initials for avatars: "JD" */
export const initials = (first, last) => {
  return ((first || '')[0] || '') + ((last || '')[0] || '')
}
