export function formatEmergencySentTime(timestamp) {
  if (!timestamp) return 'Unavailable'
  // SQLite's legacy CURRENT_TIMESTAMP format has no timezone suffix; it is UTC.
  const normalizedTimestamp = typeof timestamp === 'string' && !timestamp.includes('T') && !timestamp.includes('Z')
    ? `${timestamp.replace(' ', 'T')}Z`
    : timestamp
  const date = new Date(normalizedTimestamp)
  if (Number.isNaN(date.getTime())) return 'Unavailable'

  const datePart = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
  }).toUpperCase()
  return `${datePart}, ${timePart}`
}
