// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './AvatarIconEditor.dom.tsx';
import { AvatarIconEditor } from './AvatarIconEditor.dom.tsx';
import { GroupAvatarIcons, PersonalAvatarIcons } from '../types/Avatar.std.ts';
import { AvatarColors } from '../types/Colors.std.ts';
import { createAvatarData } from '../util/createAvatarData.std.ts';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarData: overrideProps.avatarData || createAvatarData({}),
  i18n,
  onClose: action('onClose'),
});

export default {
  title: 'Components/AvatarIconEditor',
} satisfies Meta<PropsType>;

export function PersonalIcon(): React.JSX.Element {
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

export function GroupIcon(): React.JSX.Element {
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
