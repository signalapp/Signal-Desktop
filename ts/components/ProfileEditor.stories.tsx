// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import React, { useState } from 'react';
import casual from 'casual';
import { v4 as generateUuid } from 'uuid';

import type { PropsType } from './ProfileEditor';
import enMessages from '../../_locales/en/messages.json';
import { ProfileEditor } from './ProfileEditor';
import { EditUsernameModalBody } from './EditUsernameModalBody';
import {
  UsernameEditState,
  UsernameLinkState,
  UsernameReservationState,
} from '../state/ducks/usernameEnums';
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
    conversationId: {
      defaultValue: generateUuid(),
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
    usernameLink: {
      defaultValue: 'https://signal.me/#eu/testtest',
    },
    usernameLinkFgColor: {
      defaultValue: '',
    },
    isUsernameFlagEnabled: {
      control: { type: 'checkbox' },
      defaultValue: false,
    },
    usernameEditState: {
      control: { type: 'radio' },
      defaultValue: UsernameEditState.Editing,
      options: {
        Editing: UsernameEditState.Editing,
        ConfirmingDelete: UsernameEditState.ConfirmingDelete,
        Deleting: UsernameEditState.Deleting,
      },
    },
    usernameLinkState: {
      control: { type: 'select' },
      defaultValue: UsernameLinkState.Ready,
      options: [UsernameLinkState.Ready, UsernameLinkState.Updating],
    },
    onEditStateChanged: { action: true },
    onProfileChanged: { action: true },
    onSetSkinTone: { action: true },
    saveAttachment: { action: true },
    setUsernameLinkColor: { action: true },
    showToast: { action: true },
    recentEmojis: {
      defaultValue: [],
    },
    replaceAvatar: { action: true },
    resetUsernameLink: { action: true },
    saveAvatarToDisk: { action: true },
    markCompletedUsernameOnboarding: { action: true },
    markCompletedUsernameLinkOnboarding: { action: true },
    openUsernameReservationModal: { action: true },
    setUsernameEditState: { action: true },
    deleteUsername: { action: true },
    skinTone: {
      defaultValue: 0,
    },
    userAvatarData: {
      defaultValue: [],
    },
    username: {
      defaultValue: undefined,
    },
  },
} as Meta;

function renderEditUsernameModalBody(props: {
  onClose: () => void;
}): JSX.Element {
  return (
    <EditUsernameModalBody
      i18n={i18n}
      minNickname={3}
      maxNickname={20}
      state={UsernameReservationState.Open}
      error={undefined}
      setUsernameReservationError={action('setUsernameReservationError')}
      reserveUsername={action('reserveUsername')}
      confirmUsername={action('confirmUsername')}
      {...props}
    />
  );
}

// eslint-disable-next-line react/function-component-definition
const Template: Story<PropsType> = args => {
  const [skinTone, setSkinTone] = useState(0);

  return (
    <ProfileEditor
      {...args}
      skinTone={skinTone}
      onSetSkinTone={setSkinTone}
      renderEditUsernameModalBody={renderEditUsernameModalBody}
    />
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
  username: 'signaluser.123',
};
WithUsernameFlagEnabledAndUsername.story = {
  name: 'with Username flag enabled and username',
};

export const DeletingUsername = Template.bind({});
DeletingUsername.args = {
  isUsernameFlagEnabled: true,
  username: 'signaluser.123',
  usernameEditState: UsernameEditState.Deleting,
};

export const ConfirmingDelete = Template.bind({});
ConfirmingDelete.args = {
  isUsernameFlagEnabled: true,
  username: 'signaluser.123',
  usernameEditState: UsernameEditState.ConfirmingDelete,
};
