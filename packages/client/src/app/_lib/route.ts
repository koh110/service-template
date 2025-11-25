type CreateRouteOption<PathKey extends string, Params = undefined> = {
  type: PathKey
} & (Params extends undefined
  ? Record<never, never>
  : {
      params: Params
    })

type RouteOption = CreateRouteOption<'top'> | CreateRouteOption<'login'>

export function getRoute(option: RouteOption): { path: string } {
  const { type } = option
  if (type === 'top') {
    return {
      path: '/'
    }
  }
  if (type === 'login') {
    return { path: '/login' }
  }
  // biome-ignore lint/correctness/noUnusedVariables: unreachable check
  const unreachable: never = type
  return { path: '' }
}
