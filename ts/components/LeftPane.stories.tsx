// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { select } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import type { PropsType } from './LeftPane';
import { LeftPane, LeftPaneMode } from './LeftPane';
import { CaptchaDialog } from './CaptchaDialog';
import type { ConversationType } from '../state/ducks/conversations';
import { MessageSearchResult } from './conversationList/MessageSearchResult';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { ThemeType } from '../types/Util';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';

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
  isAboutToSearchInAConversation: false,
  startSearchCounter: 0,
};

const emptySearchResultsGroup = { isLoading: false, results: [] };

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  cantAddContactToGroup: action('cantAddContactToGroup'),
  canResizeLeftPane: true,
  clearGroupCreationError: action('clearGroupCreationError'),
  clearSearch: action('clearSearch'),
  closeCantAddContactToGroupModal: action('closeCantAddContactToGroupModal'),
  closeMaximumGroupSizeModal: action('closeMaximumGroupSizeModal'),
  closeRecommendedGroupSizeModal: action('closeRecommendedGroupSizeModal'),
  composeDeleteAvatarFromDisk: action('composeDeleteAvatarFromDisk'),
  composeReplaceAvatar: action('composeReplaceAvatar'),
  composeSaveAvatarToDisk: action('composeSaveAvatarToDisk'),
  createGroup: action('createGroup'),
  getPreferredBadge: () => undefined,
  i18n,
  modeSpecificProps: defaultModeSpecificProps,
  preferredWidthFromStorage: 320,
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
  renderMessageSearchResult: (id: string) => (
    <MessageSearchResult
      body="Lorem ipsum wow"
      bodyRanges={[]}
      conversationId="marc-convo"
      from={defaultConversations[0]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      id={id}
      openConversationInternal={action('openConversationInternal')}
      sentAt={1587358800000}
      snippet="Lorem <<left>>ipsum<<right>> wow"
      theme={ThemeType.light}
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
  savePreferredLeftPaneWidth: action('savePreferredLeftPaneWidth'),
  searchInConversation: action('searchInConversation'),
  setComposeSearchTerm: action('setComposeSearchTerm'),
  setComposeGroupAvatar: action('setComposeGroupAvatar'),
  setComposeGroupName: action('setComposeGroupName'),
  setComposeGroupExpireTimer: action('setComposeGroupExpireTimer'),
  showArchivedConversations: action('showArchivedConversations'),
  showInbox: action('showInbox'),
  startComposing: action('startComposing'),
  showChooseGroupMembers: action('showChooseGroupMembers'),
  startNewConversationFromPhoneNumber: action(
    'startNewConversationFromPhoneNumber'
  ),
  startNewConversationFromUsername: action('startNewConversationFromUsername'),
  startSearch: action('startSearch'),
  startSettingGroupMetadata: action('startSettingGroupMetadata'),
  theme: React.useContext(StorybookThemeContext),
  toggleComposeEditingAvatar: action('toggleComposeEditingAvatar'),
  toggleConversationInChooseMembers: action(
    'toggleConversationInChooseMembers'
  ),
  updateSearchTerm: action('updateSearchTerm'),

  ...overrideProps,
});

// Inbox stories

story.add('Inbox: no conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: [],
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
    })}
  />
));

story.add('Inbox: only pinned conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: [],
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
    })}
  />
));

story.add('Inbox: only non-pinned conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
    })}
  />
));

story.add('Inbox: only archived conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: [],
        archivedConversations: defaultArchivedConversations,
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
    })}
  />
));

story.add('Inbox: pinned and archived conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: [],
        archivedConversations: defaultArchivedConversations,
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
    })}
  />
));

story.add('Inbox: non-pinned and archived conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: defaultConversations,
        archivedConversations: defaultArchivedConversations,
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
    })}
  />
));

story.add('Inbox: pinned and non-pinned conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
    })}
  />
));

story.add('Inbox: pinned, non-pinned, and archived conversations', () => (
  <LeftPane {...useProps()} />
));

// Search stories

story.add('Search: no results when searching everywhere', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: emptySearchResultsGroup,
        contactResults: emptySearchResultsGroup,
        messageResults: emptySearchResultsGroup,
        searchTerm: 'foo bar',
        primarySendsSms: false,
      },
    })}
  />
));

story.add('Search: no results when searching everywhere (SMS)', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: emptySearchResultsGroup,
        contactResults: emptySearchResultsGroup,
        messageResults: emptySearchResultsGroup,
        searchTerm: 'foo bar',
        primarySendsSms: true,
      },
    })}
  />
));

story.add('Search: no results when searching in a conversation', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: emptySearchResultsGroup,
        contactResults: emptySearchResultsGroup,
        messageResults: emptySearchResultsGroup,
        searchConversationName: 'Bing Bong',
        searchTerm: 'foo bar',
        primarySendsSms: false,
      },
    })}
  />
));

story.add('Search: all results loading', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
        searchTerm: 'foo bar',
        primarySendsSms: false,
      },
    })}
  />
));

story.add('Search: some results loading', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: {
          isLoading: false,
          results: defaultConversations,
        },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
        searchTerm: 'foo bar',
        primarySendsSms: false,
      },
    })}
  />
));

story.add('Search: has conversations and contacts, but not messages', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Search,
        conversationResults: {
          isLoading: false,
          results: defaultConversations,
        },
        contactResults: { isLoading: false, results: defaultConversations },
        messageResults: { isLoading: false, results: [] },
        searchTerm: 'foo bar',
        primarySendsSms: false,
      },
    })}
  />
));

story.add('Search: all results', () => (
  <LeftPane
    {...useProps({
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
        primarySendsSms: false,
      },
    })}
  />
));

// Archived stories

story.add('Archive: no archived conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Archive,
        archivedConversations: [],
        searchConversation: undefined,
        searchTerm: '',
      },
    })}
  />
));

story.add('Archive: archived conversations', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Archive,
        archivedConversations: defaultConversations,
        searchConversation: undefined,
        searchTerm: '',
      },
    })}
  />
));

story.add('Archive: searching a conversation', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Archive,
        archivedConversations: defaultConversations,
        searchConversation: undefined,
        searchTerm: '',
      },
    })}
  />
));

// Compose stories

story.add('Compose: no results', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: true,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
));

story.add('Compose: some contacts, no search term', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: [],
        isUsernamesEnabled: true,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
));

story.add('Compose: some contacts, with a search term', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: [],
        isUsernamesEnabled: true,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: 'ar',
      },
    })}
  />
));

story.add('Compose: some groups, no search term', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: defaultGroups,
        isUsernamesEnabled: true,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
));

story.add('Compose: some groups, with search term', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: defaultGroups,
        isUsernamesEnabled: true,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: 'ar',
      },
    })}
  />
));

story.add('Compose: search is valid username', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: true,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: 'someone',
      },
    })}
  />
));

story.add('Compose: search is valid username, fetching username', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: true,
        isFetchingUsername: true,
        regionCode: 'US',
        searchTerm: 'someone',
      },
    })}
  />
));

story.add('Compose: search is valid username, but flag is not enabled', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: false,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: 'someone',
      },
    })}
  />
));

story.add('Compose: all kinds of results, no search term', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: defaultGroups,
        isUsernamesEnabled: true,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
));

story.add('Compose: all kinds of results, with a search term', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: defaultGroups,
        isUsernamesEnabled: true,
        isFetchingUsername: false,
        regionCode: 'US',
        searchTerm: 'someone',
      },
    })}
  />
));

// Captcha flow

story.add('Captcha dialog: required', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
      challengeStatus: 'required',
    })}
  />
));

story.add('Captcha dialog: pending', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        startSearchCounter: 0,
      },
      challengeStatus: 'pending',
    })}
  />
));

// Set group metadata

story.add('Group Metadata: No Timer', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.SetGroupMetadata,
        groupAvatar: undefined,
        groupName: 'Group 1',
        groupExpireTimer: 0,
        hasError: false,
        isCreating: false,
        isEditingAvatar: false,
        selectedContacts: defaultConversations,
        userAvatarData: [],
      },
    })}
  />
));

story.add('Group Metadata: Regular Timer', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.SetGroupMetadata,
        groupAvatar: undefined,
        groupName: 'Group 1',
        groupExpireTimer: 24 * 3600,
        hasError: false,
        isCreating: false,
        isEditingAvatar: false,
        selectedContacts: defaultConversations,
        userAvatarData: [],
      },
    })}
  />
));

story.add('Group Metadata: Custom Timer', () => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.SetGroupMetadata,
        groupAvatar: undefined,
        groupName: 'Group 1',
        groupExpireTimer: 7 * 3600,
        hasError: false,
        isCreating: false,
        isEditingAvatar: false,
        selectedContacts: defaultConversations,
        userAvatarData: [],
      },
    })}
  />
));
