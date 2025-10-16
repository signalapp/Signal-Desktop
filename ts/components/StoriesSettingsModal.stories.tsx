// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './StoriesSettingsModal.dom.js';
import { StoriesSettingsModal } from './StoriesSettingsModal.dom.js';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../test-helpers/getDefaultConversation.std.js';
import {
  getMyStories,
  getFakeDistributionList,
} from '../test-helpers/getFakeDistributionLists.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/StoriesSettingsModal',
  component: StoriesSettingsModal,
  argTypes: {
    storyViewReceiptsEnabled: { control: 'boolean' },
  },
  args: {
    candidateConversations: Array.from(Array(100), () =>
      getDefaultConversation()
    ),
    signalConnections: Array.from(Array(42), getDefaultConversation),
    distributionLists: [],
    groupStories: Array.from(Array(2), getDefaultGroup),
    getPreferredBadge: () => undefined,
    hideStoriesSettings: action('hideStoriesSettings'),
    i18n,
    me: getDefaultConversation(),
    onDeleteList: action('onDeleteList'),
    toggleGroupsForStorySend: action('toggleGroupsForStorySend'),
    onDistributionListCreated: () => Promise.resolve(''),
    onHideMyStoriesFrom: action('onHideMyStoriesFrom'),
    onRemoveMembers: action('onRemoveMembers'),
    onRepliesNReactionsChanged: action('onRepliesNReactionsChanged'),
    onViewersUpdated: action('onViewersUpdated'),
    setMyStoriesToAllSignalConnections: action(
      'setMyStoriesToAllSignalConnections'
    ),
    toggleSignalConnectionsModal: action('toggleSignalConnectionsModal'),
    setStoriesDisabled: action('setStoriesDisabled'),
    getConversationByServiceId: () => getDefaultGroup(),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <StoriesSettingsModal {...args} />;

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
        members: fakeDistroList.memberServiceIds.map(() =>
          getDefaultConversation()
        ),
      },
    ],
  };
}
