// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './MainHeader';
import { MainHeader } from './MainHeader';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { ThemeType } from '../types/Util';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/MainHeader', module);

const requiredText = (name: string, value: string | undefined) =>
  text(name, value || '');
const optionalText = (name: string, value: string | undefined) =>
  text(name, value || '') || undefined;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  searchTerm: requiredText('searchTerm', overrideProps.searchTerm),
  searchConversation: overrideProps.searchConversation,
  selectedConversation: undefined,
  startSearchCounter: 0,
  theme: ThemeType.light,

  phoneNumber: optionalText('phoneNumber', overrideProps.phoneNumber),
  title: requiredText('title', overrideProps.title),
  name: optionalText('name', overrideProps.name),
  avatarPath: optionalText('avatarPath', overrideProps.avatarPath),
  hasPendingUpdate: Boolean(overrideProps.hasPendingUpdate),

  i18n,

  updateSearchTerm: action('updateSearchTerm'),
  clearConversationSearch: action('clearConversationSearch'),
  clearSearch: action('clearSearch'),
  startUpdate: action('startUpdate'),

  showArchivedConversations: action('showArchivedConversations'),
  startComposing: action('startComposing'),
  toggleProfileEditor: action('toggleProfileEditor'),
});

story.add('Basic', () => {
  const props = createProps({});

  return <MainHeader {...props} />;
});

story.add('Name', () => {
  const props = createProps({
    name: 'John Smith',
    title: 'John Smith',
  });

  return <MainHeader {...props} />;
});

story.add('Phone Number', () => {
  const props = createProps({
    name: 'John Smith',
    phoneNumber: '+15553004000',
  });

  return <MainHeader {...props} />;
});

story.add('Search Term', () => {
  const props = createProps({
    name: 'John Smith',
    searchTerm: 'Hewwo?',
    title: 'John Smith',
  });

  return <MainHeader {...props} />;
});

story.add('Searching Conversation', () => {
  const props = createProps({
    name: 'John Smith',
    searchConversation: getDefaultConversation(),
  });

  return <MainHeader {...props} />;
});

story.add('Searching Conversation with Term', () => {
  const props = createProps({
    name: 'John Smith',
    searchTerm: 'address',
    searchConversation: getDefaultConversation(),
  });

  return <MainHeader {...props} />;
});

story.add('Update Available', () => {
  const props = createProps({ hasPendingUpdate: true });

  return <MainHeader {...props} />;
});
