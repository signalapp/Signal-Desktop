// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import DeleteMessagesModal from './DeleteMessagesModal.dom.js';
import type { DeleteMessagesModalProps } from './DeleteMessagesModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DeleteMessagesModal',
  component: DeleteMessagesModal,
  args: {
    i18n,
    isMe: false,
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
