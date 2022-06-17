// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { select } from '@storybook/addon-knobs';

import type { PropsType } from './LeftPane';
import { LeftPane, LeftPaneMode } from './LeftPane';
import { CaptchaDialog } from './CaptchaDialog';
import { CrashReportDialog } from './CrashReportDialog';
import type { ConversationType } from '../state/ducks/conversations';
import { MessageSearchResult } from './conversationList/MessageSearchResult';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { ThemeType } from '../types/Util';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import {
  makeFakeLookupConversationWithoutUuid,
  useUuidFetchState,
} from '../test-both/helpers/fakeLookupConversationWithoutUuid';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/LeftPane',
};

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

const defaultSearchProps = {
  searchConversation: undefined,
  searchDisabled: false,
  searchTerm: 'hello',
  startSearchCounter: 0,
};

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
  ...defaultSearchProps,
  mode: LeftPaneMode.Inbox as const,
  pinnedConversations,
  conversations: defaultConversations,
  archivedConversations: defaultArchivedConversations,
  isAboutToSearchInAConversation: false,
};

const emptySearchResultsGroup = { isLoading: false, results: [] };

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => {
  let modeSpecificProps =
    overrideProps.modeSpecificProps ?? defaultModeSpecificProps;

  const [uuidFetchState, setIsFetchingUUID] = useUuidFetchState(
    'uuidFetchState' in modeSpecificProps
      ? modeSpecificProps.uuidFetchState
      : {}
  );

  if ('uuidFetchState' in modeSpecificProps) {
    modeSpecificProps = {
      ...modeSpecificProps,
      uuidFetchState,
    };
  }

  return {
    clearConversationSearch: action('clearConversationSearch'),
    clearGroupCreationError: action('clearGroupCreationError'),
    clearSearch: action('clearSearch'),
    closeMaximumGroupSizeModal: action('closeMaximumGroupSizeModal'),
    closeRecommendedGroupSizeModal: action('closeRecommendedGroupSizeModal'),
    composeDeleteAvatarFromDisk: action('composeDeleteAvatarFromDisk'),
    composeReplaceAvatar: action('composeReplaceAvatar'),
    composeSaveAvatarToDisk: action('composeSaveAvatarToDisk'),
    createGroup: action('createGroup'),
    getPreferredBadge: () => undefined,
    i18n,
    preferredWidthFromStorage: 320,
    regionCode: 'US',
    challengeStatus: select(
      'challengeStatus',
      ['idle', 'required', 'pending'],
      'idle'
    ),
    crashReportCount: select('challengeReportCount', [0, 1], 0),
    setChallengeStatus: action('setChallengeStatus'),
    lookupConversationWithoutUuid: makeFakeLookupConversationWithoutUuid(),
    showUserNotFoundModal: action('showUserNotFoundModal'),
    setIsFetchingUUID,
    showConversation: action('showConversation'),
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
        showConversation={action('showConversation')}
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
    renderCrashReportDialog: () => (
      <CrashReportDialog
        i18n={i18n}
        isPending={false}
        uploadCrashReports={action('uploadCrashReports')}
        eraseCrashReports={action('eraseCrashReports')}
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
    startSearch: action('startSearch'),
    startSettingGroupMetadata: action('startSettingGroupMetadata'),
    theme: React.useContext(StorybookThemeContext),
    toggleComposeEditingAvatar: action('toggleComposeEditingAvatar'),
    toggleConversationInChooseMembers: action(
      'toggleConversationInChooseMembers'
    ),
    updateSearchTerm: action('updateSearchTerm'),

    ...overrideProps,

    modeSpecificProps,
  };
};

export const InboxNoConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: [],
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
      },
    })}
  />
);

InboxNoConversations.story = {
  name: 'Inbox: no conversations',
};

export const InboxOnlyPinnedConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: [],
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
      },
    })}
  />
);

InboxOnlyPinnedConversations.story = {
  name: 'Inbox: only pinned conversations',
};

export const InboxOnlyNonPinnedConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
      },
    })}
  />
);

InboxOnlyNonPinnedConversations.story = {
  name: 'Inbox: only non-pinned conversations',
};

export const InboxOnlyArchivedConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: [],
        archivedConversations: defaultArchivedConversations,
        isAboutToSearchInAConversation: false,
      },
    })}
  />
);

InboxOnlyArchivedConversations.story = {
  name: 'Inbox: only archived conversations',
};

export const InboxPinnedAndArchivedConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: [],
        archivedConversations: defaultArchivedConversations,
        isAboutToSearchInAConversation: false,
      },
    })}
  />
);

InboxPinnedAndArchivedConversations.story = {
  name: 'Inbox: pinned and archived conversations',
};

export const InboxNonPinnedAndArchivedConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: defaultConversations,
        archivedConversations: defaultArchivedConversations,
        isAboutToSearchInAConversation: false,
      },
    })}
  />
);

InboxNonPinnedAndArchivedConversations.story = {
  name: 'Inbox: non-pinned and archived conversations',
};

export const InboxPinnedAndNonPinnedConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
      },
    })}
  />
);

InboxPinnedAndNonPinnedConversations.story = {
  name: 'Inbox: pinned and non-pinned conversations',
};

export const InboxPinnedNonPinnedAndArchivedConversations = (): JSX.Element => (
  <LeftPane {...useProps()} />
);

InboxPinnedNonPinnedAndArchivedConversations.story = {
  name: 'Inbox: pinned, non-pinned, and archived conversations',
};

export const SearchNoResultsWhenSearchingEverywhere = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Search,
        conversationResults: emptySearchResultsGroup,
        contactResults: emptySearchResultsGroup,
        messageResults: emptySearchResultsGroup,
        primarySendsSms: false,
      },
    })}
  />
);

SearchNoResultsWhenSearchingEverywhere.story = {
  name: 'Search: no results when searching everywhere',
};

export const SearchNoResultsWhenSearchingEverywhereSms = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Search,
        conversationResults: emptySearchResultsGroup,
        contactResults: emptySearchResultsGroup,
        messageResults: emptySearchResultsGroup,
        primarySendsSms: true,
      },
    })}
  />
);

SearchNoResultsWhenSearchingEverywhereSms.story = {
  name: 'Search: no results when searching everywhere (SMS)',
};

export const SearchNoResultsWhenSearchingInAConversation = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Search,
        conversationResults: emptySearchResultsGroup,
        contactResults: emptySearchResultsGroup,
        messageResults: emptySearchResultsGroup,
        searchConversationName: 'Bing Bong',
        primarySendsSms: false,
      },
    })}
  />
);

SearchNoResultsWhenSearchingInAConversation.story = {
  name: 'Search: no results when searching in a conversation',
};

export const SearchAllResultsLoading = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Search,
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
        primarySendsSms: false,
      },
    })}
  />
);

SearchAllResultsLoading.story = {
  name: 'Search: all results loading',
};

export const SearchSomeResultsLoading = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Search,
        conversationResults: {
          isLoading: false,
          results: defaultConversations,
        },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
        primarySendsSms: false,
      },
    })}
  />
);

SearchSomeResultsLoading.story = {
  name: 'Search: some results loading',
};

export const SearchHasConversationsAndContactsButNotMessages =
  (): JSX.Element => (
    <LeftPane
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Search,
          conversationResults: {
            isLoading: false,
            results: defaultConversations,
          },
          contactResults: { isLoading: false, results: defaultConversations },
          messageResults: { isLoading: false, results: [] },
          primarySendsSms: false,
        },
      })}
    />
  );

SearchHasConversationsAndContactsButNotMessages.story = {
  name: 'Search: has conversations and contacts, but not messages',
};

export const SearchAllResults = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Search,
        conversationResults: {
          isLoading: false,
          results: defaultConversations,
        },
        contactResults: { isLoading: false, results: defaultConversations },
        messageResults: {
          isLoading: false,
          results: [
            { id: 'msg1', type: 'outgoing', conversationId: 'foo' },
            { id: 'msg2', type: 'incoming', conversationId: 'bar' },
          ],
        },
        primarySendsSms: false,
      },
    })}
  />
);

SearchAllResults.story = {
  name: 'Search: all results',
};

export const ArchiveNoArchivedConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Archive,
        archivedConversations: [],
        searchConversation: undefined,
        searchTerm: '',
        startSearchCounter: 0,
      },
    })}
  />
);

ArchiveNoArchivedConversations.story = {
  name: 'Archive: no archived conversations',
};

export const ArchiveArchivedConversations = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Archive,
        archivedConversations: defaultConversations,
        searchConversation: undefined,
        searchTerm: '',
        startSearchCounter: 0,
      },
    })}
  />
);

ArchiveArchivedConversations.story = {
  name: 'Archive: archived conversations',
};

export const ArchiveSearchingAConversation = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Archive,
        archivedConversations: defaultConversations,
        searchConversation: undefined,
        searchTerm: '',
        startSearchCounter: 0,
      },
    })}
  />
);

ArchiveSearchingAConversation.story = {
  name: 'Archive: searching a conversation',
};

export const ComposeNoResults = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
);

ComposeNoResults.story = {
  name: 'Compose: no results',
};

export const ComposeSomeContactsNoSearchTerm = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: [],
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
);

ComposeSomeContactsNoSearchTerm.story = {
  name: 'Compose: some contacts, no search term',
};

export const ComposeSomeContactsWithASearchTerm = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: [],
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: 'ar',
      },
    })}
  />
);

ComposeSomeContactsWithASearchTerm.story = {
  name: 'Compose: some contacts, with a search term',
};

export const ComposeSomeGroupsNoSearchTerm = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: defaultGroups,
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
);

ComposeSomeGroupsNoSearchTerm.story = {
  name: 'Compose: some groups, no search term',
};

export const ComposeSomeGroupsWithSearchTerm = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: defaultGroups,
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: 'ar',
      },
    })}
  />
);

ComposeSomeGroupsWithSearchTerm.story = {
  name: 'Compose: some groups, with search term',
};

export const ComposeSearchIsValidUsername = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: 'someone',
      },
    })}
  />
);

ComposeSearchIsValidUsername.story = {
  name: 'Compose: search is valid username',
};

export const ComposeSearchIsValidUsernameFetchingUsername = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: true,
        uuidFetchState: {
          'username:someone': true,
        },
        regionCode: 'US',
        searchTerm: 'someone',
      },
    })}
  />
);

ComposeSearchIsValidUsernameFetchingUsername.story = {
  name: 'Compose: search is valid username, fetching username',
};

export const ComposeSearchIsValidUsernameButFlagIsNotEnabled =
  (): JSX.Element => (
    <LeftPane
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: [],
          isUsernamesEnabled: false,
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: 'someone',
        },
      })}
    />
  );

ComposeSearchIsValidUsernameButFlagIsNotEnabled.story = {
  name: 'Compose: search is valid username, but flag is not enabled',
};

export const ComposeSearchIsPartialPhoneNumber = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: false,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: '+1(212)555',
      },
    })}
  />
);

ComposeSearchIsPartialPhoneNumber.story = {
  name: 'Compose: search is partial phone number',
};

export const ComposeSearchIsValidPhoneNumber = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: [],
        composeGroups: [],
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: '2125555454',
      },
    })}
  />
);

ComposeSearchIsValidPhoneNumber.story = {
  name: 'Compose: search is valid phone number',
};

export const ComposeSearchIsValidPhoneNumberFetchingPhoneNumber =
  (): JSX.Element => (
    <LeftPane
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: [],
          isUsernamesEnabled: true,
          uuidFetchState: {
            'e164:+12125555454': true,
          },
          regionCode: 'US',
          searchTerm: '(212)5555454',
        },
      })}
    />
  );

ComposeSearchIsValidPhoneNumberFetchingPhoneNumber.story = {
  name: 'Compose: search is valid phone number, fetching phone number',
};

export const ComposeAllKindsOfResultsNoSearchTerm = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: defaultGroups,
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: '',
      },
    })}
  />
);

ComposeAllKindsOfResultsNoSearchTerm.story = {
  name: 'Compose: all kinds of results, no search term',
};

export const ComposeAllKindsOfResultsWithASearchTerm = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.Compose,
        composeContacts: defaultConversations,
        composeGroups: defaultGroups,
        isUsernamesEnabled: true,
        uuidFetchState: {},
        regionCode: 'US',
        searchTerm: 'someone',
      },
    })}
  />
);

ComposeAllKindsOfResultsWithASearchTerm.story = {
  name: 'Compose: all kinds of results, with a search term',
};

export const CaptchaDialogRequired = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        searchTerm: '',
      },
      challengeStatus: 'required',
    })}
  />
);

CaptchaDialogRequired.story = {
  name: 'Captcha dialog: required',
};

export const CaptchaDialogPending = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        searchTerm: '',
      },
      challengeStatus: 'pending',
    })}
  />
);

CaptchaDialogPending.story = {
  name: 'Captcha dialog: pending',
};

export const _CrashReportDialog = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations,
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        searchTerm: '',
      },
      crashReportCount: 42,
    })}
  />
);

_CrashReportDialog.story = {
  name: 'Crash report dialog',
};

export const ChooseGroupMembersPartialPhoneNumber = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.ChooseGroupMembers,
        uuidFetchState: {},
        candidateContacts: [],
        isShowingRecommendedGroupSizeModal: false,
        isShowingMaximumGroupSizeModal: false,
        isUsernamesEnabled: true,
        searchTerm: '+1(212) 555',
        regionCode: 'US',
        selectedContacts: [],
      },
    })}
  />
);

ChooseGroupMembersPartialPhoneNumber.story = {
  name: 'Choose Group Members: Partial phone number',
};

export const ChooseGroupMembersValidPhoneNumber = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.ChooseGroupMembers,
        uuidFetchState: {},
        candidateContacts: [],
        isShowingRecommendedGroupSizeModal: false,
        isShowingMaximumGroupSizeModal: false,
        isUsernamesEnabled: true,
        searchTerm: '+1(212) 555 5454',
        regionCode: 'US',
        selectedContacts: [],
      },
    })}
  />
);

ChooseGroupMembersValidPhoneNumber.story = {
  name: 'Choose Group Members: Valid phone number',
};

export const ChooseGroupMembersUsername = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        mode: LeftPaneMode.ChooseGroupMembers,
        uuidFetchState: {},
        candidateContacts: [],
        isShowingRecommendedGroupSizeModal: false,
        isShowingMaximumGroupSizeModal: false,
        isUsernamesEnabled: true,
        searchTerm: '@signal',
        regionCode: 'US',
        selectedContacts: [],
      },
    })}
  />
);

ChooseGroupMembersUsername.story = {
  name: 'Choose Group Members: username',
};

export const GroupMetadataNoTimer = (): JSX.Element => (
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
);

GroupMetadataNoTimer.story = {
  name: 'Group Metadata: No Timer',
};

export const GroupMetadataRegularTimer = (): JSX.Element => (
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
);

GroupMetadataRegularTimer.story = {
  name: 'Group Metadata: Regular Timer',
};

export const GroupMetadataCustomTimer = (): JSX.Element => (
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
);

GroupMetadataCustomTimer.story = {
  name: 'Group Metadata: Custom Timer',
};

export const SearchingConversation = (): JSX.Element => (
  <LeftPane
    {...useProps({
      modeSpecificProps: {
        ...defaultSearchProps,
        mode: LeftPaneMode.Inbox,
        pinnedConversations: [],
        conversations: defaultConversations,
        archivedConversations: [],
        isAboutToSearchInAConversation: false,
        searchConversation: getDefaultConversation(),
        searchTerm: '',
      },
    })}
  />
);
