import {
  ArrowsLeftRightIcon,
  BookOpenTextIcon,
  BracketsCurlyIcon,
  BuildingsIcon,
  CoinsIcon,
  GaugeIcon,
  GraphIcon,
  ImageSquareIcon,
  MagnifyingGlassIcon,
  RobotIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
} from '@phosphor-icons/react/ssr'
import type { IconProps } from '@phosphor-icons/react'
import type { NavIconKey } from '@/config/navigation'

const ICONS = {
  network: GraphIcon,
  bridge: ArrowsLeftRightIcon,
  staking: CoinsIcon,
  nft: ImageSquareIcon,
  sbt: SealCheckIcon,
  rwa: BuildingsIcon,
  ipfs: ShieldCheckIcon,
  agent: RobotIcon,
  anomaly: ShieldWarningIcon,
  catalog: BracketsCurlyIcon,
  guide: BookOpenTextIcon,
  dashboard: GaugeIcon,
  explorer: MagnifyingGlassIcon,
} satisfies Record<NavIconKey, unknown>

export function NavIcon({ icon, ...props }: { icon: NavIconKey } & IconProps) {
  const Icon = ICONS[icon]
  return <Icon aria-hidden {...props} />
}
