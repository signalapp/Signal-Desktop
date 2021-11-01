// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { storiesOf } from '@storybook/react';
import { text, boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './ProfileEditor';
import { ProfileEditor } from './ProfileEditor';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import {
  getFirstName,
  getLastName,
} from '../test-both/helpers/getDefaultConversation';
import { getRandomColor } from '../test-both/helpers/getRandomColor';
import { UsernameSaveState } from '../state/ducks/conversationsEnums';

const i18n = setupI18n('en', enMessages);

const stories = storiesOf('Components/ProfileEditor', module);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  aboutEmoji: overrideProps.aboutEmoji,
  aboutText: text('about', overrideProps.aboutText || ''),
  avatarPath: overrideProps.avatarPath,
  clearUsernameSave: action('clearUsernameSave'),
  conversationId: '123',
  color: overrideProps.color || getRandomColor(),
  deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
  familyName: overrideProps.familyName,
  firstName: text('firstName', overrideProps.firstName || getFirstName()),
  i18n,
  isUsernameFlagEnabled: boolean(
    'isUsernameFlagEnabled',
    overrideProps.isUsernameFlagEnabled !== undefined
      ? overrideProps.isUsernameFlagEnabled
      : false
  ),
  onEditStateChanged: action('onEditStateChanged'),
  onProfileChanged: action('onProfileChanged'),
  onSetSkinTone: overrideProps.onSetSkinTone || action('onSetSkinTone'),
  recentEmojis: [],
  replaceAvatar: action('replaceAvatar'),
  saveAvatarToDisk: action('saveAvatarToDisk'),
  saveUsername: action('saveUsername'),
  skinTone: overrideProps.skinTone || 0,
  userAvatarData: [],
  username: overrideProps.username,
  usernameSaveState: select(
    'usernameSaveState',
    Object.values(UsernameSaveState),
    overrideProps.usernameSaveState || UsernameSaveState.None
  ),
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

stories.add('with Username flag enabled', () => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
    })}
  />
));

stories.add('with Username flag enabled and username', () => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      username: 'unicorn55',
    })}
  />
));

stories.add('Username editing, saving', () => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      usernameSaveState: UsernameSaveState.Saving,
      username: 'unicorn55',
    })}
  />
));

stories.add('Username editing, username taken', () => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      usernameSaveState: UsernameSaveState.UsernameTakenError,
      username: 'unicorn55',
    })}
  />
));

stories.add('Username editing, username malformed', () => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      usernameSaveState: UsernameSaveState.UsernameMalformedError,
      username: 'unicorn55',
    })}
  />
));

stories.add('Username editing, general error', () => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      usernameSaveState: UsernameSaveState.GeneralError,
      username: 'unicorn55',
    })}
  />
));
