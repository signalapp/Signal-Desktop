// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import React from 'react';

import type { PropsType } from './SendStoryModal';
import enMessages from '../../_locales/en/messages.json';
import { SendStoryModal } from './SendStoryModal';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import {
  getMyStories,
  getFakeDistributionListsWithMembers,
} from '../test-both/helpers/getFakeDistributionLists';
import { VIDEO_MP4 } from '../types/MIME';

const i18n = setupI18n('en', enMessages);

const myStories = {
  ...getMyStories(),
  members: [],
};

export default {
  title: 'Components/SendStoryModal',
  component: SendStoryModal,
  argTypes: {
    draftAttachment: {
      defaultValue: {
        contentType: VIDEO_MP4,
        fileName: 'pixabay-Soap-Bubble-7141.mp4',
        url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
      },
    },
    candidateConversations: {
      defaultValue: Array.from(Array(100), () => getDefaultConversation()),
    },
    distributionLists: {
      defaultValue: [myStories],
    },
    getPreferredBadge: { action: true },
    groupConversations: {
      defaultValue: Array.from(Array(7), getDefaultGroup),
    },
    groupStories: {
      defaultValue: Array.from(Array(2), getDefaultGroup),
    },
    hasFirstStoryPostExperience: {
      defaultValue: false,
    },
    i18n: {
      defaultValue: i18n,
    },
    me: {
      defaultValue: getDefaultConversation(),
    },
    onClose: { action: true },
    onDeleteList: { action: true },
    onDistributionListCreated: { action: true },
    onHideMyStoriesFrom: { action: true },
    onSend: { action: true },
    onViewersUpdated: { action: true },
    setMyStoriesToAllSignalConnections: { action: true },
    signalConnections: {
      defaultValue: Array.from(Array(42), getDefaultConversation),
    },
    toggleGroupsForStorySend: { action: true },
    toggleSignalConnectionsModal: { action: true },
  },
} as Meta;

// eslint-disable-next-line react/function-component-definition
const Template: Story<PropsType> = args => <SendStoryModal {...args} />;

export const Modal = Template.bind({});
Modal.args = {
  distributionLists: getFakeDistributionListsWithMembers(),
};

export const BlockList = Template.bind({});
BlockList.args = {
  distributionLists: [
    { ...getMyStories(), members: [getDefaultConversation()] },
  ],
  groupStories: [],
};

export const AllowList = Template.bind({});
AllowList.args = {
  distributionLists: [
    {
      ...getMyStories(),
      isBlockList: false,
      members: [getDefaultConversation()],
    },
  ],
  groupStories: [],
};

export const FirstTime = Template.bind({});
FirstTime.args = {
  distributionLists: [myStories],
  groupStories: [],
  hasFirstStoryPostExperience: true,
};

export const FirstTimeAlreadyConfiguredOnMobile = Template.bind({});
FirstTime.args = {
  distributionLists: [
    {
      ...myStories,
      isBlockList: false,
      members: Array.from(Array(3), getDefaultConversation),
    },
  ],
  groupStories: [],
  hasFirstStoryPostExperience: true,
};
