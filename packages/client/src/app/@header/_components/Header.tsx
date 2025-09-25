import { APP_NAME } from '../../../constants'
import { Heading, Link } from '../../_components/ui/index'
import { getRoute } from '../../_lib/route'

export default async function Header() {
  return (
    <div className="w-full bg-(--accent-9)">
      <div className="flex items-center justify-between p-4">
        <Link
          href={getRoute({ type: 'top' }).path}
          className="hover:opacity-80 transition-opacity"
        >
          <Heading as="h1" size="5" className="text-(--gray-1)">
            {APP_NAME}
          </Heading>
        </Link>
      </div>
    </div>
  )
}
