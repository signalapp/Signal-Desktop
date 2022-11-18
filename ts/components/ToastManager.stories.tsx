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

export const MessageBodyTooLong = Template.bind({});
MessageBodyTooLong.args = {
  toast: {
    toastType: ToastType.MessageBodyTooLong,
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

export const StoryVideoError = Template.bind({});
StoryVideoError.args = {
  toast: {
    toastType: ToastType.StoryVideoError,
  },
};
