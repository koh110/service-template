export type RequestTarget =
  | { kind: 'api-user'; pathname: '/api/user' }
  | { kind: 'reserved-api'; pathname: string }
  | { kind: 'static'; pathname: string }
  | { kind: 'bad-request' }

function firstSegment(pathname: string) {
  return pathname.slice(1).split('/')[0] ?? ''
}

export function parseRequestTarget(requestUrl: string | undefined): RequestTarget {
  const rawTarget = requestUrl ?? ''
  if (!rawTarget.startsWith('/') || rawTarget.startsWith('//')) {
    return { kind: 'bad-request' }
  }

  const queryIndex = rawTarget.indexOf('?')
  const fragmentIndex = rawTarget.indexOf('#')
  let suffixIndex = rawTarget.length
  for (const index of [queryIndex, fragmentIndex]) {
    if (index >= 0 && index < suffixIndex) {
      suffixIndex = index
    }
  }
  const rawPathname = rawTarget.slice(0, suffixIndex)
  const hasSuffix = suffixIndex < rawTarget.length

  let pathname: string
  try {
    pathname = decodeURIComponent(rawPathname)
  } catch {
    return { kind: 'bad-request' }
  }

  let hasParentSegment = false
  for (const segment of pathname.split('/')) {
    if (segment === '..') {
      hasParentSegment = true
      break
    }
  }
  if (
    pathname.length === 0 ||
    pathname.startsWith('//') ||
    pathname.includes('\0') ||
    pathname.includes('\\') ||
    hasParentSegment
  ) {
    return { kind: 'bad-request' }
  }

  const reservedApi = firstSegment(pathname).toLowerCase().startsWith('api')
  if (!reservedApi) {
    return { kind: 'static', pathname }
  }

  if (rawPathname === '/api/user' && pathname === '/api/user') {
    if (hasSuffix) {
      return { kind: 'bad-request' }
    }
    return { kind: 'api-user', pathname: '/api/user' }
  }
  return { kind: 'reserved-api', pathname }
}
