type HeaderRequest = {
  rawHeaders: readonly string[]
}

type AuthorityValidation = { ok: true } | { ok: false; status: 400 | 403 }

function headerValues(request: HeaderRequest, name: string) {
  const values: string[] = []
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const headerName = request.rawHeaders[index]
    const headerValue = request.rawHeaders[index + 1]
    if (headerName?.toLowerCase() === name && headerValue !== undefined) {
      values.push(headerValue)
    }
  }
  return values
}

export function validateAuthority({
  request,
  authority,
  origin
}: {
  request: HeaderRequest
  authority: string
  origin: string
}): AuthorityValidation {
  const hosts = headerValues(request, 'host')
  if (hosts.length !== 1 || hosts[0]?.includes(',') || hosts[0] !== authority) {
    return { ok: false, status: 400 }
  }

  const origins = headerValues(request, 'origin')
  if (origins.length > 1) {
    return { ok: false, status: 403 }
  }
  for (const value of origins) {
    if (value.includes(',')) {
      return { ok: false, status: 403 }
    }
  }
  if (origins.length === 1 && origins[0] !== origin) {
    return { ok: false, status: 403 }
  }
  return { ok: true }
}
