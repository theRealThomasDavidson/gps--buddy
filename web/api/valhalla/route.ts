const UPSTREAM_URL = 'https://valhalla1.openstreetmap.de/route'

function readBody(req: any): unknown {
  const body = req?.body
  if (body == null) return null
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  return body
}

export default async function handler(req: any, res: any) {
  if (req?.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const upstreamRes = await fetch(UPSTREAM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Some public providers vary behavior by UA; being explicit makes debugging easier.
      'User-Agent': 'gps-web (vercel proxy)',
    },
    body: JSON.stringify(readBody(req)),
  })

  const text = await upstreamRes.text()
  res.statusCode = upstreamRes.status
  res.setHeader('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json; charset=utf-8')
  res.end(text)
}

