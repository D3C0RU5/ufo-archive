const TAU = Math.PI * 2
const RAD = Math.PI / 180

// NOAA's fractional-year approximation. Longitude is positive east of Greenwich.
export function getSubsolarPoint(date = new Date()) {
  const year = date.getUTCFullYear()
  const day = Math.floor(
    (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000,
  ) + 1
  const daysInYear = Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1) === 366 * 86400000 ? 366 : 365
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  const gamma = TAU / daysInYear * (day - 1 + (minutes / 60 - 12) / 24)

  const equationOfTime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  )
  const declination = 0.006918 - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma)
    + 0.00148 * Math.sin(3 * gamma)

  const longitude = ((720 - minutes - equationOfTime) / 4 + 540) % 360 - 180
  return { latitude: declination / RAD, longitude }
}

export function getSunDirection(date = new Date()) {
  const { latitude, longitude } = getSubsolarPoint(date)
  const lat = latitude * RAD
  const lon = longitude * RAD
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]
}

export function getInitialYaw(date = new Date()) {
  // Keep the terminator visible when the page opens, with daylight to the left.
  return -(getSubsolarPoint(date).longitude + 78) * RAD
}
