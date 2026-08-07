// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { AvatarColors } from '../types/Colors.std.ts';
import type { PropsType } from './AvatarEditor.dom.tsx';
import { AvatarEditor } from './AvatarEditor.dom.tsx';
import { getDefaultAvatars } from '../types/Avatar.std.ts';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarColor: overrideProps.avatarColor || AvatarColors[9],
  avatarUrl: overrideProps.avatarUrl,
  conversationId: '123',
  conversationTitle: overrideProps.conversationTitle || 'Default Title',
  deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
  i18n,
  isDisplayedAsPanel: false,
  isGroup: Boolean(overrideProps.isGroup),
  onCancel: action('onCancel'),
  onSave: action('onSave'),
  replaceAvatar: action('replaceAvatar'),
  saveAvatarToDisk: action('saveAvatarToDisk'),
  userAvatarData: overrideProps.userAvatarData ?? [],
});

export default {
  title: 'Components/AvatarEditor',
} satisfies Meta<PropsType>;

export function NoAvatarGroup(): JSX.Element {
  return (
    <AvatarEditor
      {...createProps({
        isGroup: true,
        userAvatarData: getDefaultAvatars(true),
      })}
    />
  );
}

export function NoAvatarContactNoInitials(): JSX.Element {
  return (
    <AvatarEditor
      {...createProps({
        conversationTitle: ' ',
        userAvatarData: getDefaultAvatars(),
      })}
    />
  );
}

export function NoAvatarContact(): JSX.Element {
  return (
    <AvatarEditor
      {...createProps({
        userAvatarData: getDefaultAvatars(),
      })}
    />
  );
}

export function HasAvatar(): JSX.Element {
  return (
    <AvatarEditor
      {...createProps({
        avatarUrl: '/fixtures/kitten-3-64-64.jpg',
        userAvatarData: getDefaultAvatars(),
      })}
    />
  );
}
