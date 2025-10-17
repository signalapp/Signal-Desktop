// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './AvatarIconEditor.dom.js';
import { AvatarIconEditor } from './AvatarIconEditor.dom.js';
import { GroupAvatarIcons, PersonalAvatarIcons } from '../types/Avatar.std.js';
import { AvatarColors } from '../types/Colors.std.js';
import { createAvatarData } from '../util/createAvatarData.std.js';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarData: overrideProps.avatarData || createAvatarData({}),
  i18n,
  onClose: action('onClose'),
});

export default {
  title: 'Components/AvatarIconEditor',
} satisfies Meta<PropsType>;

export function PersonalIcon(): JSX.Element {
  return (
    <AvatarIconEditor
      {...createProps({
        avatarData: createAvatarData({
          color: AvatarColors[3],
          icon: PersonalAvatarIcons[0],
        }),
      })}
    />
  );
}

export function GroupIcon(): JSX.Element {
  return (
    <AvatarIconEditor
      {...createProps({
        avatarData: createAvatarData({
          color: AvatarColors[8],
          icon: GroupAvatarIcons[0],
        }),
      })}
    />
  );
}
