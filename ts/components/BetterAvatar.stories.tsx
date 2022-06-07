// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import enMessages from '../../_locales/en/messages.json';
import { AvatarColors } from '../types/Colors';
import { GroupAvatarIcons, PersonalAvatarIcons } from '../types/Avatar';
import type { PropsType } from './BetterAvatar';
import { BetterAvatar } from './BetterAvatar';
import { createAvatarData } from '../util/createAvatarData';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

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
};

export const Text = (): JSX.Element => (
  <BetterAvatar
    {...createProps({
      avatarData: createAvatarData({
        color: AvatarColors[0],
        text: 'AH',
      }),
    })}
  />
);

export const PersonalIcon = (): JSX.Element => (
  <BetterAvatar
    {...createProps({
      avatarData: createAvatarData({
        color: AvatarColors[1],
        icon: PersonalAvatarIcons[1],
      }),
    })}
  />
);

export const GroupIcon = (): JSX.Element => (
  <BetterAvatar
    {...createProps({
      avatarData: createAvatarData({
        color: AvatarColors[1],
        icon: GroupAvatarIcons[1],
      }),
    })}
  />
);
