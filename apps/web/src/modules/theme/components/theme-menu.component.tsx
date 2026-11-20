'use client';

import { useTranslations } from 'next-intl';

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';

import ThemeIcon from '@web/modules/theme/components/theme-icon.component';
import { THEME_CHOICES, type ThemeChoice } from '@web/modules/theme/constants/theme.constants';
import { useTheme } from '@web/modules/theme/providers/theme.provider';

/**
 * The desktop's theme menu, in the header (spec 010, CA-10): the button's icon is the chosen
 * theme and its name says it («Tema: Oscuro»); it opens Claro, Oscuro and Sistema with their
 * icons, the current one checked, usable with the keyboard alone (CA-13).
 */
const ThemeMenu = () => {
  const t = useTranslations('theme');
  const { choice, setChoice } = useTheme();

  return (
    <Dropdown
      placement="bottom-end"
      // HeroUI dims an open menu's trigger to 70 %; on dark that leaves it without AA contrast.
      classNames={{ trigger: 'aria-expanded:opacity-100' }}
    >
      <DropdownTrigger>
        <Button isIconOnly variant="light" size="sm" aria-label={t('current', { name: t(choice) })}>
          <ThemeIcon choice={choice} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t('title')}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[choice]}
        onAction={(key) => setChoice(key as ThemeChoice)}
      >
        {THEME_CHOICES.map((option) => (
          <DropdownItem key={option} startContent={<ThemeIcon choice={option} />}>
            {t(option)}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

export default ThemeMenu;
