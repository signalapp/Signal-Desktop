// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './MainHeader';
import { MainHeader } from './MainHeader';
import { ThemeType } from '../types/Util';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MainHeader',
};

const requiredText = (name: string, value: string | undefined) =>
  text(name, value || '');
const optionalText = (name: string, value: string | undefined) =>
  text(name, value || '') || undefined;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  areStoriesEnabled: false,
  theme: ThemeType.light,

  phoneNumber: optionalText('phoneNumber', overrideProps.phoneNumber),
  title: requiredText('title', overrideProps.title),
  name: optionalText('name', overrideProps.name),
  avatarPath: optionalText('avatarPath', overrideProps.avatarPath),
  hasPendingUpdate: Boolean(overrideProps.hasPendingUpdate),

  i18n,

  startUpdate: action('startUpdate'),

  showArchivedConversations: action('showArchivedConversations'),
  startComposing: action('startComposing'),
  toggleProfileEditor: action('toggleProfileEditor'),
  toggleStoriesView: action('toggleStoriesView'),
});

export const Basic = (): JSX.Element => {
  const props = createProps({});

  return <MainHeader {...props} />;
};

export const Name = (): JSX.Element => {
  const props = createProps({
    name: 'John Smith',
    title: 'John Smith',
  });

  return <MainHeader {...props} />;
};

export const PhoneNumber = (): JSX.Element => {
  const props = createProps({
    name: 'John Smith',
    phoneNumber: '+15553004000',
  });

  return <MainHeader {...props} />;
};

export const UpdateAvailable = (): JSX.Element => {
  const props = createProps({ hasPendingUpdate: true });

  return <MainHeader {...props} />;
};

export const Stories = (): JSX.Element => (
  <MainHeader {...createProps({})} areStoriesEnabled />
);
