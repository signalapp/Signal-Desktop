// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { ProfileEditor, PropsType } from './ProfileEditor';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import {
  getFirstName,
  getLastName,
} from '../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const stories = storiesOf('Components/ProfileEditor', module);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  aboutEmoji: overrideProps.aboutEmoji,
  aboutText: text('about', overrideProps.aboutText || ''),
  avatarPath: overrideProps.avatarPath,
  familyName: overrideProps.familyName,
  firstName: text('firstName', overrideProps.firstName || getFirstName()),
  i18n,
  onEditStateChanged: action('onEditStateChanged'),
  onProfileChanged: action('onProfileChanged'),
  onSetSkinTone: overrideProps.onSetSkinTone || action('onSetSkinTone'),
  recentEmojis: [],
  skinTone: overrideProps.skinTone || 0,
});

stories.add('Full Set', () => {
  const [skinTone, setSkinTone] = useState(0);

  return (
    <ProfileEditor
      {...createProps({
        aboutEmoji: '🙏',
        aboutText: 'Live. Laugh. Love',
        avatarPath: '/fixtures/kitten-3-64-64.jpg',
        onSetSkinTone: setSkinTone,
        familyName: getLastName(),
        skinTone,
      })}
    />
  );
});

stories.add('with Full Name', () => (
  <ProfileEditor
    {...createProps({
      familyName: getLastName(),
    })}
  />
));

stories.add('with Custom About', () => (
  <ProfileEditor
    {...createProps({
      aboutEmoji: '🙏',
      aboutText: 'Live. Laugh. Love',
    })}
  />
));
