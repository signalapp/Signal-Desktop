// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

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

export default {
  title: 'Components/ProfileEditor',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  aboutEmoji: overrideProps.aboutEmoji,
  aboutText: text('about', overrideProps.aboutText || ''),
  profileAvatarPath: overrideProps.profileAvatarPath,
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

export const FullSet = (): JSX.Element => {
  const [skinTone, setSkinTone] = useState(0);

  return (
    <ProfileEditor
      {...createProps({
        aboutEmoji: '🙏',
        aboutText: 'Live. Laugh. Love',
        profileAvatarPath: '/fixtures/kitten-3-64-64.jpg',
        onSetSkinTone: setSkinTone,
        familyName: getLastName(),
        skinTone,
      })}
    />
  );
};

export const WithFullName = (): JSX.Element => (
  <ProfileEditor
    {...createProps({
      familyName: getLastName(),
    })}
  />
);

WithFullName.story = {
  name: 'with Full Name',
};

export const WithCustomAbout = (): JSX.Element => (
  <ProfileEditor
    {...createProps({
      aboutEmoji: '🙏',
      aboutText: 'Live. Laugh. Love',
    })}
  />
);

WithCustomAbout.story = {
  name: 'with Custom About',
};

export const WithUsernameFlagEnabled = (): JSX.Element => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
    })}
  />
);

WithUsernameFlagEnabled.story = {
  name: 'with Username flag enabled',
};

export const WithUsernameFlagEnabledAndUsername = (): JSX.Element => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      username: 'unicorn55',
    })}
  />
);

WithUsernameFlagEnabledAndUsername.story = {
  name: 'with Username flag enabled and username',
};

export const UsernameEditingSaving = (): JSX.Element => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      usernameSaveState: UsernameSaveState.Saving,
      username: 'unicorn55',
    })}
  />
);

UsernameEditingSaving.story = {
  name: 'Username editing, saving',
};

export const UsernameEditingUsernameTaken = (): JSX.Element => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      usernameSaveState: UsernameSaveState.UsernameTakenError,
      username: 'unicorn55',
    })}
  />
);

UsernameEditingUsernameTaken.story = {
  name: 'Username editing, username taken',
};

export const UsernameEditingUsernameMalformed = (): JSX.Element => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      usernameSaveState: UsernameSaveState.UsernameMalformedError,
      username: 'unicorn55',
    })}
  />
);

UsernameEditingUsernameMalformed.story = {
  name: 'Username editing, username malformed',
};

export const UsernameEditingGeneralError = (): JSX.Element => (
  <ProfileEditor
    {...createProps({
      isUsernameFlagEnabled: true,
      usernameSaveState: UsernameSaveState.GeneralError,
      username: 'unicorn55',
    })}
  />
);

UsernameEditingGeneralError.story = {
  name: 'Username editing, general error',
};
