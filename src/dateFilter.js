// Dates without a known day use the full documented month or year as their range.
export function filterSightings(sightings, { from, to }) {
  if (!from && !to) return sightings
  return sightings.filter((sighting) =>
    (!from || sighting.endDate >= from) && (!to || sighting.startDate <= to),
  )
}

// Missing month or day means the whole selected year or month.
export function buildBoundary({ year, month, day }, isEnd) {
  if (!year) return ''
  const selectedMonth = month || (isEnd ? '12' : '01')
  const selectedDay = day || (isEnd
    ? String(new Date(Number(year), Number(selectedMonth), 0).getDate()).padStart(2, '0')
    : '01')
  return `${year}-${selectedMonth}-${selectedDay}`
}
