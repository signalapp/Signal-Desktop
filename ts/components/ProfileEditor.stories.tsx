// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import React, { useState } from 'react';
import casual from 'casual';
import { v4 as generateUuid } from 'uuid';

import type { PropsType } from './ProfileEditor';
import { EditState, ProfileEditor } from './ProfileEditor';
import { UsernameEditor } from './UsernameEditor';
import {
  UsernameEditState,
  UsernameLinkState,
  UsernameReservationState,
} from '../state/ducks/usernameEnums';
import { getRandomColor } from '../test-both/helpers/getRandomColor';
import { SignalService as Proto } from '../protobuf';
import { EmojiSkinTone } from './fun/data/emojis';

const { i18n } = window.SignalContext;

export default {
  component: ProfileEditor,
  title: 'Components/ProfileEditor',
  argTypes: {
    usernameEditState: {
      control: { type: 'radio' },
      options: [
        UsernameEditState.Editing,
        UsernameEditState.ConfirmingDelete,
        UsernameEditState.Deleting,
      ],
    },
    usernameCorrupted: {
      control: 'boolean',
    },
    usernameLinkState: {
      control: { type: 'select' },
      options: [UsernameLinkState.Ready, UsernameLinkState.Updating],
    },
    usernameLinkCorrupted: {
      control: 'boolean',
    },
  },
  args: {
    aboutEmoji: '',
    aboutText: casual.sentence,
    profileAvatarUrl: undefined,
    conversationId: generateUuid(),
    color: getRandomColor(),
    deleteAvatarFromDisk: action('deleteAvatarFromDisk'),
    editState: EditState.None,
    familyName: casual.last_name,
    firstName: casual.first_name,
    i18n,

    usernameLink: 'https://signal.me/#eu/testtest',
    usernameLinkColor: Proto.AccountRecord.UsernameLink.Color.PURPLE,
    usernameEditState: UsernameEditState.Editing,
    usernameLinkState: UsernameLinkState.Ready,

    recentEmojis: [],
    emojiSkinToneDefault: EmojiSkinTone.None,
    userAvatarData: [],
    username: undefined,

    onProfileChanged: action('onProfileChanged'),
    onEmojiSkinToneDefaultChange: action('onEmojiSkinToneDefaultChange'),
    saveAttachment: action('saveAttachment'),
    setUsernameLinkColor: action('setUsernameLinkColor'),
    showToast: action('showToast'),
    replaceAvatar: action('replaceAvatar'),
    resetUsernameLink: action('resetUsernameLink'),
    saveAvatarToDisk: action('saveAvatarToDisk'),
    markCompletedUsernameLinkOnboarding: action(
      'markCompletedUsernameLinkOnboarding'
    ),
    openUsernameReservationModal: action('openUsernameReservationModal'),
    setUsernameEditState: action('setUsernameEditState'),
    deleteUsername: action('deleteUsername'),
  },
} satisfies Meta<PropsType>;

function renderUsernameEditor(props: { onClose: () => void }): JSX.Element {
  return (
    <UsernameEditor
      i18n={i18n}
      minNickname={3}
      maxNickname={20}
      state={UsernameReservationState.Open}
      error={undefined}
      recoveredUsername={undefined}
      usernameCorrupted={false}
      setUsernameReservationError={action('setUsernameReservationError')}
      clearUsernameReservation={action('clearUsernameReservation')}
      reserveUsername={action('reserveUsername')}
      confirmUsername={action('confirmUsername')}
      showToast={action('showToast')}
      {...props}
    />
  );
}

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => {
  const [emojiSkinToneDefault, setEmojiSkinToneDefault] = useState(
    EmojiSkinTone.None
  );
  const [editState, setEditState] = useState(args.editState);

  return (
    <ProfileEditor
      {...args}
      editState={editState}
      emojiSkinToneDefault={emojiSkinToneDefault}
      onEmojiSkinToneDefaultChange={setEmojiSkinToneDefault}
      renderUsernameEditor={renderUsernameEditor}
      setEditState={setEditState}
    />
  );
};

export const FullSet = Template.bind({});
FullSet.args = {
  aboutEmoji: '🙏',
  aboutText: 'Live. Laugh. Love',
  familyName: casual.last_name,
  firstName: casual.first_name,
  profileAvatarUrl: '/fixtures/kitten-3-64-64.jpg',
};

export const WithFullName = Template.bind({});
WithFullName.args = {
  familyName: casual.last_name,
};
export const WithCustomAbout = Template.bind({});
WithCustomAbout.args = {
  aboutEmoji: '🙏',
  aboutText: 'Live. Laugh. Love',
};

export const WithUsername = Template.bind({});
WithUsername.args = {
  username: 'signaluser.123',
};

export const DeletingUsername = Template.bind({});
DeletingUsername.args = {
  username: 'signaluser.123',
  usernameEditState: UsernameEditState.Deleting,
};

export const ConfirmingDelete = Template.bind({});
ConfirmingDelete.args = {
  username: 'signaluser.123',
  usernameEditState: UsernameEditState.ConfirmingDelete,
};

export const Corrupted = Template.bind({});
Corrupted.args = {
  username: 'signaluser.123',
  usernameCorrupted: true,
};
