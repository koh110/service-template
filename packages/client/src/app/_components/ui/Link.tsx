import { Link as RadixLink } from '@radix-ui/themes'
import NextLink from 'next/link'
import type { ComponentProps } from 'react'

export type LinkProps = ComponentProps<typeof NextLink> & {
  radix?: ComponentProps<typeof RadixLink>
}
export function Link({ children, radix, ...props }: LinkProps) {
  return (
    <RadixLink {...radix} asChild>
      <NextLink {...props}>{children}</NextLink>
    </RadixLink>
  )
}

export function ButtonLink({
  children,
  ...props
}: ComponentProps<typeof NextLink>) {
  return (
    <RadixLink asChild>
      <NextLink
        {...props}
        className="px-4 py-2 rounded bg-(--accent-9) hover:bg-(--accent-10) text-(--gray-1)"
      >
        {children}
      </NextLink>
    </RadixLink>
  )
}
