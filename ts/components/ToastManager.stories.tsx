// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './ToastManager';
import enMessages from '../../_locales/en/messages.json';
import { ToastManager } from './ToastManager';
import { ToastType } from '../state/ducks/toast';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ToastManager',
  component: ToastManager,
  argTypes: {
    hideToast: { action: true },
    i18n: {
      defaultValue: i18n,
    },
    toast: {
      defaultValue: undefined,
    },
  },
} as Meta;

// eslint-disable-next-line react/function-component-definition
const Template: Story<PropsType> = args => <ToastManager {...args} />;

export const UndefinedToast = Template.bind({});
UndefinedToast.args = {};

export const InvalidToast = Template.bind({});
InvalidToast.args = {
  toast: {
    toastType: 'this is a toast that does not exist' as ToastType,
  },
};

export const AddingUserToGroup = Template.bind({});
AddingUserToGroup.args = {
  toast: {
    toastType: ToastType.AddingUserToGroup,
    parameters: {
      contact: 'Sam Mirete',
    },
  },
};

export const CannotStartGroupCall = Template.bind({});
CannotStartGroupCall.args = {
  toast: {
    toastType: ToastType.CannotStartGroupCall,
  },
};

export const CopiedUsername = Template.bind({});
CopiedUsername.args = {
  toast: {
    toastType: ToastType.CopiedUsername,
  },
};

export const CopiedUsernameLink = Template.bind({});
CopiedUsernameLink.args = {
  toast: {
    toastType: ToastType.CopiedUsernameLink,
  },
};

export const DeleteForEveryoneFailed = Template.bind({});
DeleteForEveryoneFailed.args = {
  toast: {
    toastType: ToastType.DeleteForEveryoneFailed,
  },
};

export const Error = Template.bind({});
Error.args = {
  toast: {
    toastType: ToastType.Error,
  },
};

export const FailedToDeleteUsername = Template.bind({});
FailedToDeleteUsername.args = {
  toast: {
    toastType: ToastType.FailedToDeleteUsername,
  },
};

export const MessageBodyTooLong = Template.bind({});
MessageBodyTooLong.args = {
  toast: {
    toastType: ToastType.MessageBodyTooLong,
  },
};

export const PinnedConversationsFull = Template.bind({});
PinnedConversationsFull.args = {
  toast: {
    toastType: ToastType.PinnedConversationsFull,
  },
};

export const StoryMuted = Template.bind({});
StoryMuted.args = {
  toast: {
    toastType: ToastType.StoryMuted,
  },
};

export const ReportedSpamAndBlocked = Template.bind({});
ReportedSpamAndBlocked.args = {
  toast: {
    toastType: ToastType.ReportedSpamAndBlocked,
  },
};

export const StoryReact = Template.bind({});
StoryReact.args = {
  toast: {
    toastType: ToastType.StoryReact,
  },
};

export const StoryReply = Template.bind({});
StoryReply.args = {
  toast: {
    toastType: ToastType.StoryReply,
  },
};

export const StoryVideoError = Template.bind({});
StoryVideoError.args = {
  toast: {
    toastType: ToastType.StoryVideoError,
  },
};

export const StoryVideoTooLong = Template.bind({});
StoryVideoTooLong.args = {
  toast: {
    toastType: ToastType.StoryVideoTooLong,
  },
};

export const StoryVideoUnsupported = Template.bind({});
StoryVideoUnsupported.args = {
  toast: {
    toastType: ToastType.StoryVideoUnsupported,
  },
};

export const UserAddedToGroup = Template.bind({});
UserAddedToGroup.args = {
  toast: {
    toastType: ToastType.UserAddedToGroup,
    parameters: {
      contact: 'Sam Mirete',
      group: 'Hike Group 🏔',
    },
  },
};
