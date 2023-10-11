// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
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
import type { StoryDistributionIdString } from '../types/StoryDistributionId';

const i18n = setupI18n('en', enMessages);

const myStories = {
  ...getMyStories(),
  members: [],
};

export default {
  title: 'Components/SendStoryModal',
  component: SendStoryModal,
  args: {
    draftAttachment: {
      contentType: VIDEO_MP4,
      fileName: 'pixabay-Soap-Bubble-7141.mp4',
      url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
      size: 1,
    },
    candidateConversations: Array.from(Array(100), () =>
      getDefaultConversation()
    ),
    distributionLists: [myStories],
    getPreferredBadge: () => undefined,
    groupConversations: Array.from(Array(7), getDefaultGroup),
    groupStories: Array.from(Array(2), getDefaultGroup),
    hasFirstStoryPostExperience: false,
    i18n,
    me: getDefaultConversation(),
    onClose: action('onClose'),
    onDeleteList: action('onDeleteList'),
    onDistributionListCreated: () =>
      Promise.resolve('' as StoryDistributionIdString),
    onHideMyStoriesFrom: action('onHideMyStoriesFrom'),
    onMediaPlaybackStart: action('onMediaPlaybackStart'),
    onSend: action('onSend'),
    onViewersUpdated: action('onViewersUpdated'),
    setMyStoriesToAllSignalConnections: action(
      'setMyStoriesToAllSignalConnections'
    ),
    mostRecentActiveStoryTimestampByGroupOrDistributionList: {},
    signalConnections: Array.from(Array(42), getDefaultConversation),
    toggleGroupsForStorySend: () => Promise.resolve(),
    toggleSignalConnectionsModal: action('toggleSignalConnectionsModal'),
  },
} satisfies Meta<PropsType>;

export function Modal(args: PropsType): JSX.Element {
  return (
    <SendStoryModal
      {...args}
      distributionLists={getFakeDistributionListsWithMembers()}
    />
  );
}

export function BlockList(args: PropsType): JSX.Element {
  return (
    <SendStoryModal
      {...args}
      distributionLists={[
        { ...getMyStories(), members: [getDefaultConversation()] },
      ]}
      groupStories={[]}
    />
  );
}

export function AllowList(args: PropsType): JSX.Element {
  return (
    <SendStoryModal
      {...args}
      distributionLists={[
        {
          ...getMyStories(),
          isBlockList: false,
          members: [getDefaultConversation()],
        },
      ]}
      groupStories={[]}
    />
  );
}

export function FirstTime(args: PropsType): JSX.Element {
  return (
    <SendStoryModal
      {...args}
      distributionLists={[myStories]}
      groupStories={[]}
      hasFirstStoryPostExperience
    />
  );
}

export function FirstTimeAlreadyConfiguredOnMobile(
  args: PropsType
): JSX.Element {
  return (
    <SendStoryModal
      {...args}
      distributionLists={[
        {
          ...myStories,
          isBlockList: false,
          members: Array.from(Array(3), getDefaultConversation),
        },
      ]}
      groupStories={[]}
      hasFirstStoryPostExperience
    />
  );
}
