// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { select } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { LeftPane, LeftPaneMode, PropsType } from './LeftPane';
import { CaptchaDialog } from './CaptchaDialog';
import { ConversationType } from '../state/ducks/conversations';
import { MessageSearchResult } from './conversationList/MessageSearchResult';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/LeftPane', module);

const defaultConversations: Array<ConversationType> = [
  getDefaultConversation({
    id: 'fred-convo',
    title: 'Fred Willard',
  }),
  getDefaultConversation({
    id: 'marc-convo',
    isSelected: true,
    title: 'Marc Barraca',
  }),
];

const defaultGroups: Array<ConversationType> = [
  getDefaultConversation({
    id: 'biking-group',
    title: 'Mtn Biking Arizona 🚵☀️⛰',
    type: 'group',
    sharedGroupNames: [],
  }),
  getDefaultConversation({
    id: 'dance-group',
    title: 'Are we dancers? 💃',
    type: 'group',
    sharedGroupNames: [],
  }),
];

const defaultArchivedConversations: Array<ConversationType> = [
  getDefaultConversation({
    id: 'michelle-archive-convo',
    title: 'Michelle Mercure',
    isArchived: true,
  }),
];

const pinnedConversations: Array<ConversationType> = [
  getDefaultConversation({
    id: 'philly-convo',
    isPinned: true,
    title: 'Philip Glass',
  }),
  getDefaultConversation({
    id: 'robbo-convo',
    isPinned: true,
    title: 'Robert Moog',
  }),
];

const defaultModeSpecificProps = {
  mode: LeftPaneMode.Inbox as const,
  pinnedConversations,
  conversations: defaultConversations,
  archivedConversations: defaultArchivedConversations,
};

const emptySearchResultsGroup = { isLoading: false, results: [] };

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  cantAddContactToGroup: action('cantAddContactToGroup'),
  clearGroupCreationError: action('clearGroupCreationError'),
  closeCantAddContactToGroupModal: action('closeCantAddContactToGroupModal'),
  closeMaximumGroupSizeModal: action('closeMaximumGroupSizeModal'),
  closeRecommendedGroupSizeModal: action('closeRecommendedGroupSizeModal'),
  createGroup: action('createGroup'),
  i18n,
  modeSpecificProps: defaultModeSpecificProps,
  openConversationInternal: action('openConversationInternal'),
  regionCode: 'US',
  challengeStatus: select(
    'challengeStatus',
    ['idle', 'required', 'pending'],
    'idle'
  ),
  setChallengeStatus: action('setChallengeStatus'),
  renderExpiredBuildDialog: () => <div />,
  renderMainHeader: () => <div />,
  renderMessageSearchResult: (id: string, style: React.CSSProperties) => (
    <MessageSearchResult
      body="Lorem ipsum wow"
      bodyRanges={[]}
      conversationId="marc-convo"
      from={defaultConversations[0]}
      i18n={i18n}
      id={id}
      openConversationInternal={action('openConversationInternal')}
      sentAt={1587358800000}
      snippet="Lorem <<left>>ipsum<<right>> wow"
      style={style}
      to={defaultConversations[1]}
    />
  ),
  renderNetworkStatus: () => <div />,
  renderRelinkDialog: () => <div />,
  renderUpdateDialog: () => <div />,
  renderCaptchaDialog: () => (
    <CaptchaDialog
      i18n={i18n}
      isPending={overrideProps.challengeStatus === 'pending'}
      onContinue={action('onCaptchaContinue')}
      onSkip={action('onCaptchaSkip')}
    />
  ),
  selectedConversationId: undefined,
  selectedMessageId: undefined,
  setComposeSearchTerm: action('setComposeSearchTerm'),
  setComposeGroupAvatar: action('setComposeGroupAvatar'),
  setComposeGroupName: action('setComposeGroupName'),
  showArchivedConversations: action('showArchivedConversations'),
  showInbox: action('showInbox'),
  startComposing: action('startComposing'),
  showChooseGroupMembers: action('showChooseGroupMembers'),
  startNewConversationFromPhoneNumber: action(
    'startNewConversationFromPhoneNumber'
  ),
  startSettingGroupMetadata: action('startSettingGroupMetadata'),
  toggleConversationInChooseMembers: action(
    'toggleConversationInChooseMembers'
  ),

  ...overrideProps,
});

// Inbox stories

story.add('Inbox: no conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: [],
        archivedConversations: [],
      },
    })}
  />
));

story.add('Inbox: only pinned conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: [],
        archivedConversations: [],
      },
    })}
  />
));

story.add('Inbox: only non-pinned conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: defaultConversations,
        archivedConversations: [],
      },
    })}
  />
));

story.add('Inbox: only archived conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: [],
        archivedConversations: defaultArchivedConversations,
      },
    })}
  />
));

story.add('Inbox: pinned and archived conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: [],
        archivedConversations: defaultArchivedConversations,
      },
    })}
  />
));

story.add('Inbox: non-pinned and archived conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: defaultConversations,
        archivedConversations: defaultArchivedConversations,
      },
    })}
  />
));

story.add('Inbox: pinned and non-pinned conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
      },
    })}
  />
));

story.add('Inbox: pinned, non-pinned, and archived conversations', () => (
  <LeftPane {...createProps()} />
));

// Search stories

story.add('Search: no results when searching everywhere', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: emptySearchResultsGroup,
        contactResults: emptySearchResultsGroup,
        messageResults: emptySearchResultsGroup,
        searchTerm: 'foo bar',
      },
    })}
  />
));

story.add('Search: no results when searching in a conversation', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: emptySearchResultsGroup,
        contactResults: emptySearchResultsGroup,
        messageResults: emptySearchResultsGroup,
        searchConversationName: 'Bing Bong',
        searchTerm: 'foo bar',
      },
    })}
  />
));

story.add('Search: all results loading', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
        searchTerm: 'foo bar',
      },
    })}
  />
));

story.add('Search: some results loading', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: {
          isLoading: false,
          results: defaultConversations,
        },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
        searchTerm: 'foo bar',
      },
    })}
  />
));

story.add('Search: has conversations and contacts, but not messages', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: {
          isLoading: false,
          results: defaultConversations,
        },
        contactResults: { isLoading: false, results: defaultConversations },
        messageResults: { isLoading: false, results: [] },
        searchTerm: 'foo bar',
      },
    })}
  />
));

story.add('Search: all results', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: {
          isLoading: false,
          results: defaultConversations,
        },
        contactResults: { isLoading: false, results: defaultConversations },
        messageResults: {
          isLoading: false,
          results: [
            { id: 'msg1', conversationId: 'foo' },
            { id: 'msg2', conversationId: 'bar' },
          ],
        },
        searchTerm: 'foo bar',
      },
    })}
  />
));

// Archived stories

story.add('Archive: no archived conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Archive,
        archivedConversations: [],
      },
    })}
  />
));

story.add('Archive: archived conversations', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Archive,
        archivedConversations: defaultConversations,
      },
    })}
  />
));

// Compose stories

story.add('Compose: no contacts or groups', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
));

story.add('Compose: some contacts, no groups, no search term', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: [],
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
));

story.add('Compose: some contacts, no groups, with a search term', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'ar',
      },
    })}
  />
));

story.add('Compose: some groups, no contacts, no search term', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: defaultGroups,
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
));

story.add('Compose: some groups, no contacts, with search term', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: defaultGroups,
        regionCode: 'US',
        searchTerm: 'ar',
      },
    })}
  />
));

story.add('Compose: some contacts, some groups, no search term', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: defaultGroups,
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
));

story.add('Compose: some contacts, some groups, with a search term', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: defaultGroups,
        regionCode: 'US',
        searchTerm: 'ar',
      },
    })}
  />
));

// Captcha flow

story.add('Captcha dialog: required', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
      },
      challengeStatus: 'required',
    })}
  />
));

story.add('Captcha dialog: pending', () => (
  <LeftPane
    {...createProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
      },
      challengeStatus: 'pending',
    })}
  />
));
