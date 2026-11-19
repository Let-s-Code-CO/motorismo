'use client';

import { Avatar } from '@heroui/react';

type UserAvatarProps = {
  name: string;
  /** Photo of the linked Google account (CA-30; spec 004 CA-20); initials while it loads or if missing. */
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/** Decorative avatar: the user's name is always shown beside it as text. */
const UserAvatar = ({ name, src, size = 'sm', className = '' }: UserAvatarProps) => (
  <Avatar
    aria-hidden
    name={name}
    src={src ?? undefined}
    showFallback
    size={size}
    imgProps={{ referrerPolicy: 'no-referrer' }}
    className={`shrink-0 text-xs font-medium ${className}`}
  />
);

export default UserAvatar;
