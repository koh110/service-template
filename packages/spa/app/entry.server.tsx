import { renderToReadableStream } from 'react-dom/server'
import { type EntryContext, ServerRouter } from 'react-router'

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  let statusCode = responseStatusCode
  const stream = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        statusCode = 500
        console.error(error)
      }
    }
  )
  await stream.allReady

  responseHeaders.set('Content-Type', 'text/html; charset=utf-8')
  return new Response(stream, {
    status: statusCode,
    headers: responseHeaders
  })
}
