// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean, select, text } from '@storybook/addon-knobs';

import type { Props } from './AvatarPopup';
import { AvatarPopup } from './AvatarPopup';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColors } from '../types/Colors';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import { getFakeBadge } from '../test-both/helpers/getFakeBadge';

const i18n = setupI18n('en', enMessages);

const colorMap: Record<string, AvatarColorType> = AvatarColors.reduce(
  (m, color) => ({
    ...m,
    [color]: color,
  }),
  {}
);

const conversationTypeMap: Record<string, Props['conversationType']> = {
  direct: 'direct',
  group: 'group',
};

const useProps = (overrideProps: Partial<Props> = {}): Props => ({
  acceptedMessageRequest: true,
  avatarPath: text('avatarPath', overrideProps.avatarPath || ''),
  badge: overrideProps.badge,
  color: select('color', colorMap, overrideProps.color || AvatarColors[0]),
  conversationType: select(
    'conversationType',
    conversationTypeMap,
    overrideProps.conversationType || 'direct'
  ),
  hasPendingUpdate: Boolean(overrideProps.hasPendingUpdate),
  i18n,
  isMe: true,
  name: text('name', overrideProps.name || ''),
  noteToSelf: boolean('noteToSelf', overrideProps.noteToSelf || false),
  onEditProfile: action('onEditProfile'),
  onViewArchive: action('onViewArchive'),
  onViewPreferences: action('onViewPreferences'),
  phoneNumber: text('phoneNumber', overrideProps.phoneNumber || ''),
  profileName: text('profileName', overrideProps.profileName || ''),
  sharedGroupNames: [],
  size: 80,
  startUpdate: action('startUpdate'),
  style: {},
  theme: React.useContext(StorybookThemeContext),
  title: text('title', overrideProps.title || ''),
});

export default {
  title: 'Components/Avatar Popup',
};

export const AvatarOnly = (): JSX.Element => {
  const props = useProps();

  return <AvatarPopup {...props} />;
};

export const HasBadge = (): JSX.Element => {
  const props = useProps({
    badge: getFakeBadge(),
    title: 'Janet Yellen',
  });

  return <AvatarPopup {...props} />;
};

HasBadge.story = {
  name: 'Has badge',
};

export const Title = (): JSX.Element => {
  const props = useProps({
    title: 'My Great Title',
  });

  return <AvatarPopup {...props} />;
};

export const ProfileName = (): JSX.Element => {
  const props = useProps({
    profileName: 'Sam Neill',
  });

  return <AvatarPopup {...props} />;
};

export const PhoneNumber = (): JSX.Element => {
  const props = useProps({
    profileName: 'Sam Neill',
    phoneNumber: '(555) 867-5309',
  });

  return <AvatarPopup {...props} />;
};

export const UpdateAvailable = (): JSX.Element => {
  const props = useProps({
    hasPendingUpdate: true,
  });

  return <AvatarPopup {...props} />;
};
