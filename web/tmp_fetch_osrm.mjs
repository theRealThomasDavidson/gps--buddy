const START_QUERY = '3rd Avenue SW, Carmel, IN 46032'
const END_QUERY = 'Rangeline KinderCare, Carmel, IN 46032'

async function fetchJson(url, init) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 12_000)
  const res = await fetch(url, { ...init, signal: ac.signal }).finally(() => clearTimeout(t))
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`)
  }
  return JSON.parse(text)
}

async function geocodeOpenMeteo(query) {
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search')
  u.searchParams.set('name', query)
  u.searchParams.set('count', '1')
  u.searchParams.set('language', 'en')
  u.searchParams.set('format', 'json')
  u.searchParams.set('country_code', 'US')

  const json = await fetchJson(u.toString())
  const r = json?.results?.[0]
  if (!r || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') {
    throw new Error(`No geocode hit for: ${query}`)
  }
  return { lat: r.latitude, lng: r.longitude, label: [r.name, r.admin1, r.country].filter(Boolean).join(', ') }
}

async function geocodeNominatim(query) {
  const u = new URL('https://nominatim.openstreetmap.org/search')
  u.searchParams.set('format', 'jsonv2')
  u.searchParams.set('q', query)
  u.searchParams.set('limit', '1')
  u.searchParams.set('accept-language', 'en')

  const json = await fetchJson(u.toString(), {
    headers: {
      'Accept-Language': 'en',
      // Some deployments honor these; harmless if ignored.
      'User-Agent': 'gps-demo/0.0 (local dev)',
      Referer: 'http://localhost/',
    },
  })

  const it = Array.isArray(json) ? json[0] : null
  if (!it || typeof it.lat !== 'string' || typeof it.lon !== 'string') {
    throw new Error(`No geocode hit (nominatim) for: ${query}`)
  }
  const lat = Number(it.lat)
  const lng = Number(it.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Invalid coords (nominatim) for: ${query}`)
  }
  return { lat, lng, label: it.display_name ?? query }
}

async function geocode(query) {
  try {
    return await geocodeOpenMeteo(query)
  } catch {
    return await geocodeNominatim(query)
  }
}

const start = await geocode(START_QUERY)
const end = await geocode(END_QUERY)

const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`
const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`

const json = await fetchJson(osrmUrl)
const steps = (json.routes?.[0]?.legs ?? []).flatMap((l) => l.steps ?? [])
const types = Array.from(new Set(steps.map((s) => s.maneuver?.type).filter(Boolean)))
const roundaboutSteps = steps.filter((s) => s.maneuver?.type === 'roundabout' || s.maneuver?.type === 'rotary')

console.log(
  JSON.stringify(
    {
      start,
      end,
      osrmUrl,
      types,
      roundaboutStepsCount: roundaboutSteps.length,
      sampleRoundabout: roundaboutSteps[0]?.maneuver ?? null,
    },
    null,
    2,
  ),
)

