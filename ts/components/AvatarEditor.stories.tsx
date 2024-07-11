// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { AvatarColors } from '../types/Colors';
import type { PropsType } from './AvatarEditor';
import { AvatarEditor } from './AvatarEditor';
import { getDefaultAvatars } from '../types/Avatar';
import { createAvatarData } from '../util/createAvatarData';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  avatarColor: overrideProps.avatarColor || AvatarColors[9],
  avatarUrl: overrideProps.avatarUrl,
  conversationId: '123',
  conversationTitle: overrideProps.conversationTitle || 'Default Title',
  deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
  i18n,
  isGroup: Boolean(overrideProps.isGroup),
  onCancel: action('onCancel'),
  onSave: action('onSave'),
  replaceAvatar: action('replaceAvatar'),
  saveAvatarToDisk: action('saveAvatarToDisk'),
  userAvatarData: overrideProps.userAvatarData || [
    createAvatarData({
      imagePath: '/fixtures/kitten-3-64-64.jpg',
    }),
    createAvatarData({
      color: 'A110',
      text: 'YA',
    }),
    createAvatarData({
      color: 'A120',
      text: 'OK',
    }),
    createAvatarData({
      color: 'A130',
      text: 'F',
    }),
    createAvatarData({
      color: 'A140',
      text: '🏄💣',
    }),
    createAvatarData({
      color: 'A150',
      text: '😇🙃😆',
    }),
    createAvatarData({
      color: 'A160',
      text: '🦊F💦',
    }),
    createAvatarData({
      color: 'A170',
      text: 'J',
    }),
    createAvatarData({
      color: 'A180',
      text: 'ZAP',
    }),
    createAvatarData({
      color: 'A190',
      text: '🍍P',
    }),
    createAvatarData({
      color: 'A200',
      text: '🌵',
    }),
    createAvatarData({
      color: 'A210',
      text: 'NAP',
    }),
  ],
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

export function NoAvatarMe(): JSX.Element {
  return (
    <AvatarEditor {...createProps({ userAvatarData: getDefaultAvatars() })} />
  );
}

export function HasAvatar(): JSX.Element {
  return (
    <AvatarEditor
      {...createProps({
        avatarUrl: '/fixtures/kitten-3-64-64.jpg',
      })}
    />
  );
}
