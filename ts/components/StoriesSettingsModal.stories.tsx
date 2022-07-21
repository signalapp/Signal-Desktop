// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './StoriesSettingsModal';
import enMessages from '../../_locales/en/messages.json';
import { MY_STORIES_ID } from '../types/Stories';
import { StoriesSettingsModal } from './StoriesSettingsModal';
import { UUID } from '../types/UUID';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoriesSettingsModal',
  component: StoriesSettingsModal,
  argTypes: {
    candidateConversations: {
      defaultValue: Array.from(Array(100), () => getDefaultConversation()),
    },
    distributionLists: {
      defaultValue: [],
    },
    getPreferredBadge: { action: true },
    hideStoriesSettings: { action: true },
    i18n: {
      defaultValue: i18n,
    },
    me: {
      defaultValue: getDefaultConversation(),
    },
    onDeleteList: { action: true },
    onDistributionListCreated: { action: true },
    onHideMyStoriesFrom: { action: true },
    onRemoveMember: { action: true },
    onRepliesNReactionsChanged: { action: true },
    onViewersUpdated: { action: true },
    setMyStoriesToAllSignalConnections: { action: true },
    toggleSignalConnectionsModal: { action: true },
  },
} as Meta;

const Template: Story<PropsType> = args => <StoriesSettingsModal {...args} />;

export const MyStories = Template.bind({});
MyStories.args = {
  distributionLists: [
    {
      allowsReplies: true,
      id: MY_STORIES_ID,
      isBlockList: false,
      members: [],
      name: MY_STORIES_ID,
    },
  ],
};

export const MyStoriesBlockList = Template.bind({});
MyStoriesBlockList.args = {
  distributionLists: [
    {
      allowsReplies: true,
      id: MY_STORIES_ID,
      isBlockList: true,
      members: Array.from(Array(2), () => getDefaultConversation()),
      name: MY_STORIES_ID,
    },
  ],
};

export const MyStoriesExclusive = Template.bind({});
MyStoriesExclusive.args = {
  distributionLists: [
    {
      allowsReplies: false,
      id: MY_STORIES_ID,
      isBlockList: false,
      members: Array.from(Array(11), () => getDefaultConversation()),
      name: MY_STORIES_ID,
    },
  ],
};

export const SingleList = Template.bind({});
SingleList.args = {
  distributionLists: [
    {
      allowsReplies: true,
      id: MY_STORIES_ID,
      isBlockList: false,
      members: [],
      name: MY_STORIES_ID,
    },
    {
      allowsReplies: true,
      id: UUID.generate().toString(),
      isBlockList: false,
      members: Array.from(Array(4), () => getDefaultConversation()),
      name: 'Thailand 2021',
    },
  ],
};
