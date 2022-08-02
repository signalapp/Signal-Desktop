// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './StoriesSettingsModal';
import enMessages from '../../_locales/en/messages.json';
import { StoriesSettingsModal } from './StoriesSettingsModal';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import {
  getMyStories,
  getFakeDistributionList,
} from '../test-both/helpers/getFakeDistributionLists';

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
{
  const myStories = getMyStories();
  MyStories.args = {
    distributionLists: [
      {
        ...myStories,
        members: [],
      },
    ],
  };
}

export const MyStoriesBlockList = Template.bind({});
{
  const myStories = getMyStories();
  MyStoriesBlockList.args = {
    distributionLists: [
      {
        ...myStories,
        members: Array.from(Array(2), () => getDefaultConversation()),
      },
    ],
  };
}

export const MyStoriesExclusive = Template.bind({});
{
  const myStories = getMyStories();
  MyStoriesExclusive.args = {
    distributionLists: [
      {
        ...myStories,
        isBlockList: false,
        members: Array.from(Array(11), () => getDefaultConversation()),
      },
    ],
  };
}

export const SingleList = Template.bind({});
{
  const myStories = getMyStories();
  const fakeDistroList = getFakeDistributionList();
  SingleList.args = {
    distributionLists: [
      {
        ...myStories,
        members: [],
      },
      {
        ...fakeDistroList,
        members: fakeDistroList.memberUuids.map(() => getDefaultConversation()),
      },
    ],
  };
}
