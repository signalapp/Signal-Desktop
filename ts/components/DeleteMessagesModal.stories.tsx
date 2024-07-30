// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import DeleteMessagesModal from './DeleteMessagesModal';
import type { DeleteMessagesModalProps } from './DeleteMessagesModal';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/DeleteMessagesModal',
  component: DeleteMessagesModal,
  args: {
    i18n,
    isMe: false,
    isDeleteSyncSendEnabled: false,
    canDeleteForEveryone: true,
    messageCount: 1,
    onClose: action('onClose'),
    onDeleteForMe: action('onDeleteForMe'),
    onDeleteForEveryone: action('onDeleteForEveryone'),
    showToast: action('showToast'),
  },
} satisfies Meta<DeleteMessagesModalProps>;

function createProps(args: Partial<DeleteMessagesModalProps>) {
  return {
    i18n,
    isMe: false,
    isDeleteSyncSendEnabled: false,
    canDeleteForEveryone: true,
    messageCount: 1,
    onClose: action('onClose'),
    onDeleteForMe: action('onDeleteForMe'),
    onDeleteForEveryone: action('onDeleteForEveryone'),
    showToast: action('showToast'),
    ...args,
  };
}

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<DeleteMessagesModalProps> = args => {
  return <DeleteMessagesModal {...args} />;
};

export const OneMessage = Template.bind({});

export const ThreeMessages = Template.bind({});
ThreeMessages.args = createProps({
  messageCount: 3,
});

export const IsMe = Template.bind({});
IsMe.args = createProps({
  isMe: true,
});

export const IsMeThreeMessages = Template.bind({});
IsMeThreeMessages.args = createProps({
  isMe: true,
  messageCount: 3,
});

export const DeleteSyncEnabled = Template.bind({});
DeleteSyncEnabled.args = createProps({
  isDeleteSyncSendEnabled: true,
});

export const IsMeDeleteSyncEnabled = Template.bind({});
IsMeDeleteSyncEnabled.args = createProps({
  isDeleteSyncSendEnabled: true,
  isMe: true,
});
