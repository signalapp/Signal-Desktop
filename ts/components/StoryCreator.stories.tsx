// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './StoryCreator';
import enMessages from '../../_locales/en/messages.json';
import { StoryCreator } from './StoryCreator';
import { fakeAttachment } from '../test-both/helpers/fakeAttachment';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../test-both/helpers/getDefaultConversation';
import { getFakeDistributionListsWithMembers } from '../test-both/helpers/getFakeDistributionLists';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/StoryCreator',
  component: StoryCreator,
  args: {
    candidateConversations: Array.from(Array(100), getDefaultConversation),
    debouncedMaybeGrabLinkPreview: action('debouncedMaybeGrabLinkPreview'),
    distributionLists: getFakeDistributionListsWithMembers(),
    getPreferredBadge: () => undefined,
    groupConversations: Array.from(Array(7), getDefaultGroup),
    groupStories: Array.from(Array(4), getDefaultGroup),
    hasFirstStoryPostExperience: false,
    i18n,
    imageToBlurHash: async () => 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
    installedPacks: [],
    isSending: false,
    linkPreview: undefined,
    me: getDefaultConversation(),
    onClose: action('onClose'),
    onDeleteList: action('onDeleteList'),
    onDistributionListCreated: undefined,
    onHideMyStoriesFrom: action('onHideMyStoriesFrom'),
    onSend: action('onSend'),
    onSetSkinTone: action('onSetSkinTone'),
    onUseEmoji: action('onUseEmoji'),
    onViewersUpdated: action('onViewersUpdated'),
    processAttachment: undefined,
    recentEmojis: [],
    recentStickers: [],
    sendStoryModalOpenStateChanged: action('sendStoryModalOpenStateChanged'),
    setMyStoriesToAllSignalConnections: action(
      'setMyStoriesToAllSignalConnections'
    ),
    signalConnections: Array.from(Array(42), getDefaultConversation),
    skinTone: 0,
    toggleSignalConnectionsModal: action('toggleSignalConnectionsModal'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <StoryCreator {...args} />;

export const Default = Template.bind({});
Default.args = {};

export const LinkPreview = Template.bind({});
LinkPreview.args = {
  linkPreview: {
    domain: 'www.catsandkittens.lolcats',
    image: fakeAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
    }),
    title: 'Cats & Kittens LOL',
    url: 'https://www.catsandkittens.lolcats/kittens/page/1',
    isCallLink: false,
  },
};

export const FirstTime = Template.bind({});
FirstTime.args = {
  hasFirstStoryPostExperience: true,
};

export const Sending = Template.bind({});
Sending.args = {
  isSending: true,
};
