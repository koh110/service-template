import type { ComponentProps } from 'react'
import { Button as RadixButton } from '@radix-ui/themes'

export function Button({
  children,
  ...props
}: ComponentProps<typeof RadixButton>) {
  return <RadixButton {...props}>{children}</RadixButton>
}
