// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React, { useState } from 'react';
import casual from 'casual';

import type { PropsType } from './ProfileEditor';
import enMessages from '../../_locales/en/messages.json';
import { ProfileEditor } from './ProfileEditor';
import { UUID } from '../types/UUID';
import { UsernameSaveState } from '../state/ducks/conversationsEnums';
import { getRandomColor } from '../test-both/helpers/getRandomColor';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  component: ProfileEditor,
  title: 'Components/ProfileEditor',
  argTypes: {
    aboutEmoji: {
      defaultValue: '',
    },
    aboutText: {
      defaultValue: casual.sentence,
    },
    profileAvatarPath: {
      defaultValue: undefined,
    },
    clearUsernameSave: { action: true },
    conversationId: {
      defaultValue: UUID.generate().toString(),
    },
    color: {
      defaultValue: getRandomColor(),
    },
    deleteAvatarFromDisk: { action: true },
    familyName: {
      defaultValue: casual.last_name,
    },
    firstName: {
      defaultValue: casual.first_name,
    },
    i18n: {
      defaultValue: i18n,
    },
    isUsernameFlagEnabled: {
      control: { type: 'checkbox' },
      defaultValue: false,
    },
    onEditStateChanged: { action: true },
    onProfileChanged: { action: true },
    onSetSkinTone: { action: true },
    recentEmojis: {
      defaultValue: [],
    },
    replaceAvatar: { action: true },
    saveAvatarToDisk: { action: true },
    saveUsername: { action: true },
    skinTone: {
      defaultValue: 0,
    },
    userAvatarData: {
      defaultValue: [],
    },
    username: {
      defaultValue: casual.username,
    },
    usernameSaveState: {
      control: { type: 'radio' },
      defaultValue: UsernameSaveState.None,
      options: {
        None: UsernameSaveState.None,
        Saving: UsernameSaveState.Saving,
        UsernameTakenError: UsernameSaveState.UsernameTakenError,
        UsernameMalformedError: UsernameSaveState.UsernameMalformedError,
        GeneralError: UsernameSaveState.GeneralError,
        DeleteFailed: UsernameSaveState.DeleteFailed,
        Success: UsernameSaveState.Success,
      },
    },
  },
} as Meta;

const Template: Story<PropsType> = args => {
  const [skinTone, setSkinTone] = useState(0);

  return (
    <ProfileEditor {...args} skinTone={skinTone} onSetSkinTone={setSkinTone} />
  );
};

export const FullSet = Template.bind({});
FullSet.args = {
  aboutEmoji: '🙏',
  aboutText: 'Live. Laugh. Love',
  familyName: casual.last_name,
  firstName: casual.first_name,
  profileAvatarPath: '/fixtures/kitten-3-64-64.jpg',
};

export const WithFullName = Template.bind({});
WithFullName.args = {
  familyName: casual.last_name,
};
WithFullName.story = {
  name: 'with Full Name',
};

export const WithCustomAbout = Template.bind({});
WithCustomAbout.args = {
  aboutEmoji: '🙏',
  aboutText: 'Live. Laugh. Love',
};
WithCustomAbout.story = {
  name: 'with Custom About',
};

export const WithUsernameFlagEnabled = Template.bind({});
WithUsernameFlagEnabled.args = {
  isUsernameFlagEnabled: true,
};
WithUsernameFlagEnabled.story = {
  name: 'with Username flag enabled',
};

export const WithUsernameFlagEnabledAndUsername = Template.bind({});
WithUsernameFlagEnabledAndUsername.args = {
  isUsernameFlagEnabled: true,
  username: casual.username,
};
WithUsernameFlagEnabledAndUsername.story = {
  name: 'with Username flag enabled and username',
};

export const UsernameEditingSaving = Template.bind({});
UsernameEditingSaving.args = {
  isUsernameFlagEnabled: true,
  usernameSaveState: UsernameSaveState.Saving,
  username: casual.username,
};
UsernameEditingSaving.story = {
  name: 'Username editing, saving',
};

export const UsernameEditingUsernameTaken = Template.bind({});
UsernameEditingUsernameTaken.args = {
  isUsernameFlagEnabled: true,
  usernameSaveState: UsernameSaveState.UsernameTakenError,
  username: casual.username,
};
UsernameEditingUsernameTaken.story = {
  name: 'Username editing, username taken',
};

export const UsernameEditingUsernameMalformed = Template.bind({});
UsernameEditingUsernameMalformed.args = {
  isUsernameFlagEnabled: true,
  usernameSaveState: UsernameSaveState.UsernameMalformedError,
  username: casual.username,
};
UsernameEditingUsernameMalformed.story = {
  name: 'Username editing, username malformed',
};

export const UsernameEditingGeneralError = Template.bind({});
UsernameEditingGeneralError.args = {
  isUsernameFlagEnabled: true,
  usernameSaveState: UsernameSaveState.GeneralError,
  username: casual.username,
};
UsernameEditingGeneralError.story = {
  name: 'Username editing, general error',
};
