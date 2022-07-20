// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './MainHeader';
import enMessages from '../../_locales/en/messages.json';
import { MainHeader } from './MainHeader';
import { ThemeType } from '../types/Util';
import { setupI18n } from '../util/setupI18n';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MainHeader',
  component: MainHeader,
  argTypes: {
    areStoriesEnabled: {
      defaultValue: false,
    },
    avatarPath: {
      defaultValue: undefined,
    },
    hasPendingUpdate: {
      defaultValue: false,
    },
    i18n: {
      defaultValue: i18n,
    },
    name: {
      defaultValue: undefined,
    },
    phoneNumber: {
      defaultValue: undefined,
    },
    showArchivedConversations: { action: true },
    startComposing: { action: true },
    startUpdate: { action: true },
    theme: {
      defaultValue: ThemeType.light,
    },
    title: {
      defaultValue: '',
    },
    toggleProfileEditor: { action: true },
    toggleStoriesView: { action: true },
    unreadStoriesCount: {
      defaultValue: 0,
    },
  },
} as Meta;

const Template: Story<PropsType> = args => <MainHeader {...args} />;

export const Basic = Template.bind({});
Basic.args = {};

export const Name = Template.bind({});
{
  const { name, title } = getDefaultConversation();
  Name.args = {
    name,
    title,
  };
}

export const PhoneNumber = Template.bind({});
{
  const { name, e164: phoneNumber } = getDefaultConversation();
  PhoneNumber.args = {
    name,
    phoneNumber,
  };
}

export const UpdateAvailable = Template.bind({});
UpdateAvailable.args = {
  hasPendingUpdate: true,
};

export const Stories = Template.bind({});
Stories.args = {
  areStoriesEnabled: true,
  unreadStoriesCount: 6,
};

export const StoriesOverflow = Template.bind({});
StoriesOverflow.args = {
  areStoriesEnabled: true,
  unreadStoriesCount: 69,
};
