import { Monitor, Moon, Sun } from 'lucide-react';

import type { ThemeChoice } from '@web/modules/theme/constants/theme.constants';

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

type ThemeIconProps = { choice: ThemeChoice; className?: string };

/** Sun for «Claro», moon for «Oscuro», screen for «Sistema» (spec 010, CA-09, CA-10). Decorative. */
const ThemeIcon = ({ choice, className = 'size-4' }: ThemeIconProps) => {
  const Icon = ICONS[choice];
  return <Icon aria-hidden data-icon={choice} className={className} />;
};

export default ThemeIcon;
