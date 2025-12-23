// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import { AvatarColors } from '../types/Colors.std.js';
import { GroupAvatarIcons, PersonalAvatarIcons } from '../types/Avatar.std.js';
import type { PropsType } from './BetterAvatar.dom.js';
import { BetterAvatar } from './BetterAvatar.dom.js';
import { createAvatarData } from '../util/createAvatarData.std.js';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarData:
    overrideProps.avatarData ||
    createAvatarData({ color: AvatarColors[0], text: 'OOO' }),
  i18n,
  isSelected: Boolean(overrideProps.isSelected),
  onClick: action('onClick'),
  onDelete: action('onDelete'),
  size: 80,
});

export default {
  title: 'Components/BetterAvatar',
} satisfies Meta<PropsType>;

export function Text(): React.JSX.Element {
  return (
    <BetterAvatar
      {...createProps({
        avatarData: createAvatarData({
          color: AvatarColors[0],
          text: 'AH',
        }),
      })}
    />
  );
}

export function PersonalIcon(): React.JSX.Element {
  return (
    <BetterAvatar
      {...createProps({
        avatarData: createAvatarData({
          color: AvatarColors[1],
          icon: PersonalAvatarIcons[1],
        }),
      })}
    />
  );
}

export function GroupIcon(): React.JSX.Element {
  return (
    <BetterAvatar
      {...createProps({
        avatarData: createAvatarData({
          color: AvatarColors[1],
          icon: GroupAvatarIcons[1],
        }),
      })}
    />
  );
}
