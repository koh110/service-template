import { Button as RadixButton } from '@radix-ui/themes'
import type { ComponentProps } from 'react'

export function Button({
  children,
  ...props
}: ComponentProps<typeof RadixButton>) {
  return <RadixButton {...props}>{children}</RadixButton>
}
