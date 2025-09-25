import { Heading as RadixHeading } from '@radix-ui/themes'
import type { ComponentProps } from 'react'

export type HeadingProps = ComponentProps<typeof RadixHeading>

export function Heading(props: HeadingProps) {
  return <RadixHeading {...props} />
}
