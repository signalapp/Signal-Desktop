// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './LeftPane';
import { LeftPane } from './LeftPane';
import { CaptchaDialog } from './CaptchaDialog';
import { CrashReportDialog } from './CrashReportDialog';
import { ToastManager } from './ToastManager';
import type { PropsType as DialogNetworkStatusPropsType } from './DialogNetworkStatus';
import { DialogExpiredBuild } from './DialogExpiredBuild';
import { DialogNetworkStatus } from './DialogNetworkStatus';
import { DialogRelink } from './DialogRelink';
import type { PropsType as DialogUpdatePropsType } from './DialogUpdate';
import { DialogUpdate } from './DialogUpdate';
import { UnsupportedOSDialog } from './UnsupportedOSDialog';
import type { ConversationType } from '../state/ducks/conversations';
import { MessageSearchResult } from './conversationList/MessageSearchResult';
import { setupI18n } from '../util/setupI18n';
import { DurationInSeconds, DAY } from '../util/durations';
import enMessages from '../../_locales/en/messages.json';
import { LeftPaneMode } from '../types/leftPane';
import { ThemeType } from '../types/Util';
import {
  getDefaultConversation,
  getDefaultGroupListItem,
} from '../test-both/helpers/getDefaultConversation';
import { DialogType } from '../types/Dialogs';
import { SocketStatus } from '../types/SocketStatus';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import {
  makeFakeLookupConversationWithoutServiceId,
  useUuidFetchState,
} from '../test-both/helpers/fakeLookupConversationWithoutServiceId';
import type { GroupListItemConversationType } from './conversationList/GroupListItem';

const i18n = setupI18n('en', enMessages);

type OverridePropsType = Partial<PropsType> & {
  dialogNetworkStatus?: Partial<DialogNetworkStatusPropsType>;
  dialogUpdate?: Partial<DialogUpdatePropsType>;
};

export default {
  title: 'Components/LeftPane',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

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
  filterByUnread: false,
  isSearchingGlobally: true,
  searchConversation: undefined,
  searchDisabled: false,
  searchTerm: 'hello',
  startSearchCounter: 0,
};

const defaultGroups: Array<GroupListItemConversationType> = [
  getDefaultGroupListItem({
    id: 'biking-group',
    title: 'Mtn Biking Arizona 🚵☀️⛰',
  }),
  getDefaultGroupListItem({
    id: 'dance-group',
    title: 'Are we dancers? 💃',
  }),
];

const backupMediaDownloadProgress = {
  downloadedBytes: 1024,
  totalBytes: 4098,
  downloadBannerDismissed: false,
  isIdle: false,
  isPaused: false,
};
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
  filterByUnread: false,
  mode: LeftPaneMode.Inbox as const,
  pinnedConversations,
  conversations: defaultConversations,
  archivedConversations: defaultArchivedConversations,
  isAboutToSearch: false,
};

const emptySearchResultsGroup = { isLoading: false, results: [] };

const useProps = (overrideProps: OverridePropsType = {}): PropsType => {
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

  const isUpdateDownloaded = false;

  return {
    otherTabsUnreadStats: {
      unreadCount: 0,
      unreadMentionsCount: 0,
      markedUnread: false,
    },
    backupMediaDownloadProgress: {
      downloadBannerDismissed: false,
      isIdle: false,
      isPaused: false,
      totalBytes: 0,
      downloadedBytes: 0,
    },
    clearConversationSearch: action('clearConversationSearch'),
    clearGroupCreationError: action('clearGroupCreationError'),
    clearSearchQuery: action('clearSearchQuery'),
    closeMaximumGroupSizeModal: action('closeMaximumGroupSizeModal'),
    closeRecommendedGroupSizeModal: action('closeRecommendedGroupSizeModal'),
    composeDeleteAvatarFromDisk: action('composeDeleteAvatarFromDisk'),
    composeReplaceAvatar: action('composeReplaceAvatar'),
    composeSaveAvatarToDisk: action('composeSaveAvatarToDisk'),
    createGroup: action('createGroup'),
    dismissBackupMediaDownloadBanner: action(
      'dismissBackupMediaDownloadBanner'
    ),
    pauseBackupMediaDownload: action('pauseBackupMediaDownload'),
    resumeBackupMediaDownload: action('resumeBackupMediaDownload'),
    cancelBackupMediaDownload: action('cancelBackupMediaDownload'),
    endConversationSearch: action('endConversationSearch'),
    endSearch: action('endSearch'),
    getPreferredBadge: () => undefined,
    hasFailedStorySends: false,
    hasPendingUpdate: false,
    i18n,
    isMacOS: false,
    preferredWidthFromStorage: 320,
    challengeStatus: 'idle',
    crashReportCount: 0,

    hasNetworkDialog: false,
    hasExpiredDialog: false,
    hasRelinkDialog: false,
    hasUpdateDialog: false,
    unsupportedOSDialogType: undefined,
    usernameCorrupted: false,
    usernameLinkCorrupted: false,
    isUpdateDownloaded,
    navTabsCollapsed: false,

    setChallengeStatus: action('setChallengeStatus'),
    lookupConversationWithoutServiceId:
      makeFakeLookupConversationWithoutServiceId(),
    showUserNotFoundModal: action('showUserNotFoundModal'),
    setIsFetchingUUID,
    preloadConversation: action('preloadConversation'),
    showConversation: action('showConversation'),
    blockConversation: action('blockConversation'),
    onOutgoingAudioCallInConversation: action(
      'onOutgoingAudioCallInConversation'
    ),
    onOutgoingVideoCallInConversation: action(
      'onOutgoingVideoCallInConversation'
    ),
    removeConversation: action('removeConversation'),
    renderMessageSearchResult: (id: string) => (
      <MessageSearchResult
        body="Lorem ipsum wow"
        bodyRanges={[]}
        conversationId="marc-convo"
        from={defaultConversations[0]}
        getPreferredBadge={() => undefined}
        i18n={i18n}
        id={id}
        sentAt={1587358800000}
        showConversation={action('showConversation')}
        snippet="Lorem <<left>>ipsum<<right>> wow"
        theme={ThemeType.light}
        to={defaultConversations[1]}
      />
    ),

    renderNetworkStatus: props => (
      <DialogNetworkStatus
        i18n={i18n}
        socketStatus={SocketStatus.CLOSED}
        isOnline={false}
        isOutage={false}
        manualReconnect={action('manualReconnect')}
        {...overrideProps.dialogNetworkStatus}
        {...props}
      />
    ),
    renderRelinkDialog: props => (
      <DialogRelink
        i18n={i18n}
        relinkDevice={action('relinkDevice')}
        {...props}
      />
    ),
    renderUpdateDialog: props => (
      <DialogUpdate
        i18n={i18n}
        dialogType={
          isUpdateDownloaded ? DialogType.AutoUpdate : DialogType.DownloadReady
        }
        dismissDialog={action('dismissUpdate')}
        snoozeUpdate={action('snoozeUpdate')}
        startUpdate={action('startUpdate')}
        currentVersion="1.0.0"
        {...overrideProps.dialogUpdate}
        {...props}
      />
    ),

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
        writeCrashReportsToLog={action('writeCrashReportsToLog')}
        eraseCrashReports={action('eraseCrashReports')}
      />
    ),
    renderExpiredBuildDialog: props => <DialogExpiredBuild {...props} />,
    renderUnsupportedOSDialog: props => (
      <UnsupportedOSDialog
        i18n={i18n}
        OS="macOS"
        expirationTimestamp={Date.now() + 5 * DAY}
        {...props}
      />
    ),
    renderToastManager: ({ containerWidthBreakpoint }) => (
      <ToastManager
        OS="unused"
        hideToast={action('hideToast')}
        i18n={i18n}
        onShowDebugLog={action('onShowDebugLog')}
        onUndoArchive={action('onUndoArchive')}
        openFileInFolder={action('openFileInFolder')}
        showAttachmentNotAvailableModal={action(
          'showAttachmentNotAvailableModal'
        )}
        toast={undefined}
        megaphone={undefined}
        containerWidthBreakpoint={containerWidthBreakpoint}
        isInFullScreenCall={false}
      />
    ),
    selectedConversationId: undefined,
    targetedMessageId: undefined,
    openUsernameReservationModal: action('openUsernameReservationModal'),
    savePreferredLeftPaneWidth: action('savePreferredLeftPaneWidth'),
    searchInConversation: action('searchInConversation'),
    setComposeSearchTerm: action('setComposeSearchTerm'),
    setComposeSelectedRegion: action('setComposeSelectedRegion'),
    setComposeGroupAvatar: action('setComposeGroupAvatar'),
    setComposeGroupName: action('setComposeGroupName'),
    setComposeGroupExpireTimer: action('setComposeGroupExpireTimer'),
    showArchivedConversations: action('showArchivedConversations'),
    showInbox: action('showInbox'),
    startComposing: action('startComposing'),
    showChooseGroupMembers: action('showChooseGroupMembers'),
    showFindByUsername: action('showFindByUsername'),
    showFindByPhoneNumber: action('showFindByPhoneNumber'),
    startSearch: action('startSearch'),
    startSettingGroupMetadata: action('startSettingGroupMetadata'),
    theme: React.useContext(StorybookThemeContext),
    toggleComposeEditingAvatar: action('toggleComposeEditingAvatar'),
    toggleConversationInChooseMembers: action(
      'toggleConversationInChooseMembers'
    ),
    toggleNavTabsCollapse: action('toggleNavTabsCollapse'),
    toggleProfileEditor: action('toggleProfileEditor'),
    updateFilterByUnread: action('updateFilterByUnread'),
    updateSearchTerm: action('updateSearchTerm'),

    ...overrideProps,

    modeSpecificProps,
  };
};

function LeftPaneInContainer(props: PropsType): JSX.Element {
  return (
    <div style={{ height: '600px' }}>
      <LeftPane {...props} />
    </div>
  );
}

export function InboxNoConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations: [],
          conversations: [],
          archivedConversations: [],
          isAboutToSearch: false,
        },
      })}
    />
  );
}

export function InboxBackupMediaDownload(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        backupMediaDownloadProgress,
      })}
    />
  );
}

export function InboxBackupMediaDownloadWithDialogs(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        backupMediaDownloadProgress,
        unsupportedOSDialogType: 'error',
      })}
    />
  );
}
export function InboxBackupMediaDownloadWithDialogsAndUnpinnedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        backupMediaDownloadProgress,
        unsupportedOSDialogType: 'error',
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations: [],
          conversations: defaultConversations,
          archivedConversations: [],
          isAboutToSearch: false,
        },
      })}
    />
  );
}

export function InboxUsernameCorrupted(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations: [],
          conversations: [],
          archivedConversations: [],
          isAboutToSearch: false,
        },
        usernameCorrupted: true,
      })}
    />
  );
}

export function InboxUsernameLinkCorrupted(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations: [],
          conversations: [],
          archivedConversations: [],
          isAboutToSearch: false,
        },
        usernameLinkCorrupted: true,
      })}
    />
  );
}

export function InboxOnlyPinnedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations,
          conversations: [],
          archivedConversations: [],
          isAboutToSearch: false,
        },
      })}
    />
  );
}

export function InboxOnlyNonPinnedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations: [],
          conversations: defaultConversations,
          archivedConversations: [],
          isAboutToSearch: false,
        },
      })}
    />
  );
}

export function InboxOnlyArchivedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations: [],
          conversations: [],
          archivedConversations: defaultArchivedConversations,
          isAboutToSearch: false,
        },
      })}
    />
  );
}

export function InboxPinnedAndArchivedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations,
          conversations: [],
          archivedConversations: defaultArchivedConversations,
          isAboutToSearch: false,
        },
      })}
    />
  );
}

export function InboxNonPinnedAndArchivedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations: [],
          conversations: defaultConversations,
          archivedConversations: defaultArchivedConversations,
          isAboutToSearch: false,
        },
      })}
    />
  );
}

export function InboxPinnedAndNonPinnedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations,
          conversations: defaultConversations,
          archivedConversations: [],
          isAboutToSearch: false,
        },
      })}
    />
  );
}

export function InboxPinnedAndNonPinnedConversationsWithBackupDownload(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations,
          conversations: defaultConversations,
          archivedConversations: [],
          isAboutToSearch: false,
        },
        backupMediaDownloadProgress,
      })}
    />
  );
}

export function InboxPinnedNonPinnedAndArchivedConversations(): JSX.Element {
  return <LeftPaneInContainer {...useProps()} />;
}

export function SearchNoResultsWhenSearchingEverywhere(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Search,
          conversationResults: emptySearchResultsGroup,
          contactResults: emptySearchResultsGroup,
          messageResults: emptySearchResultsGroup,
        },
      })}
    />
  );
}

export function SearchNoResultsWhenSearchingInAConversation(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Search,
          conversationResults: emptySearchResultsGroup,
          contactResults: emptySearchResultsGroup,
          messageResults: emptySearchResultsGroup,
          searchConversationName: 'Bing Bong',
        },
      })}
    />
  );
}

export function SearchNoResultsUnreadFilterAndQuery(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          filterByUnread: true,
          mode: LeftPaneMode.Search,
          conversationResults: emptySearchResultsGroup,
          contactResults: emptySearchResultsGroup,
          messageResults: emptySearchResultsGroup,
        },
      })}
    />
  );
}

export function SearchNoResultsUnreadFilterWithoutQuery(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          searchTerm: '',
          filterByUnread: true,
          mode: LeftPaneMode.Search,
          conversationResults: emptySearchResultsGroup,
          contactResults: emptySearchResultsGroup,
          messageResults: emptySearchResultsGroup,
        },
      })}
    />
  );
}

export function SearchAllResultsLoading(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Search,
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
        },
      })}
    />
  );
}

export function SearchSomeResultsLoading(): JSX.Element {
  return (
    <LeftPaneInContainer
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
        },
      })}
    />
  );
}

export function SearchHasConversationsAndContactsButNotMessages(): JSX.Element {
  return (
    <LeftPaneInContainer
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
        },
      })}
    />
  );
}

export function SearchAllResults(): JSX.Element {
  return (
    <LeftPaneInContainer
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
        },
      })}
    />
  );
}

export function SearchAllResultsUnreadFilter(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          filterByUnread: true,
          mode: LeftPaneMode.Search,
          conversationResults: {
            isLoading: false,
            results: defaultConversations,
          },
          contactResults: { isLoading: false, results: [] },
          messageResults: {
            isLoading: false,
            results: [],
          },
        },
      })}
    />
  );
}

export function ArchiveNoArchivedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Archive,
          archivedConversations: [],
          isSearchingGlobally: false,
          searchConversation: undefined,
          searchTerm: '',
          startSearchCounter: 0,
        },
      })}
    />
  );
}

export function ArchiveArchivedConversations(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Archive,
          archivedConversations: defaultConversations,
          isSearchingGlobally: false,
          searchConversation: undefined,
          searchTerm: '',
          startSearchCounter: 0,
        },
      })}
    />
  );
}

export function ArchiveSearchingAConversation(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Archive,
          archivedConversations: defaultConversations,
          isSearchingGlobally: false,
          searchConversation: undefined,
          searchTerm: '',
          startSearchCounter: 0,
        },
      })}
    />
  );
}

export function ComposeNoResults(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: [],
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: '',
          username: undefined,
        },
      })}
    />
  );
}

export function ComposeSomeContactsNoSearchTerm(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: defaultConversations,
          composeGroups: [],
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: '',
          username: undefined,
        },
      })}
    />
  );
}

export function ComposeSomeContactsWithASearchTerm(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: defaultConversations,
          composeGroups: [],
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: 'ar',
          username: undefined,
        },
      })}
    />
  );
}

export function ComposeSomeGroupsNoSearchTerm(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: defaultGroups,
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: '',
          username: undefined,
        },
      })}
    />
  );
}

export function ComposeSomeGroupsWithSearchTerm(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: defaultGroups,
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: 'ar',
          username: undefined,
        },
      })}
    />
  );
}

export function ComposeSearchIsValidUsername(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: [],
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: 'someone',
          username: 'someone',
        },
      })}
    />
  );
}

export function ComposeSearchIsValidUsernameFetchingUsername(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: [],
          uuidFetchState: {
            'username:someone': true,
          },
          regionCode: 'US',
          searchTerm: 'someone',
          username: 'someone',
        },
      })}
    />
  );
}

export function ComposeSearchIsValidPhoneNumber(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: [],
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: '2125555454',
          username: undefined,
        },
      })}
    />
  );
}

export function ComposeSearchIsValidPhoneNumberFetchingPhoneNumber(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: [],
          composeGroups: [],
          uuidFetchState: {
            'e164:+12125555454': true,
          },
          regionCode: 'US',
          searchTerm: '(212)5555454',
          username: undefined,
        },
      })}
    />
  );
}

export function ComposeAllKindsOfResultsNoSearchTerm(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: defaultConversations,
          composeGroups: defaultGroups,
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: '',
          username: undefined,
        },
      })}
    />
  );
}

export function ComposeAllKindsOfResultsWithASearchTerm(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.Compose,
          composeContacts: defaultConversations,
          composeGroups: defaultGroups,
          uuidFetchState: {},
          regionCode: 'US',
          searchTerm: 'someone',
          username: 'someone',
        },
      })}
    />
  );
}

export function CaptchaDialogRequired(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations,
          conversations: defaultConversations,
          archivedConversations: [],
          isAboutToSearch: false,
          searchTerm: '',
        },
        challengeStatus: 'required',
      })}
    />
  );
}

export function CaptchaDialogPending(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations,
          conversations: defaultConversations,
          archivedConversations: [],
          isAboutToSearch: false,
          searchTerm: '',
        },
        challengeStatus: 'pending',
      })}
    />
  );
}

export function _CrashReportDialog(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations,
          conversations: defaultConversations,
          archivedConversations: [],
          isAboutToSearch: false,
          searchTerm: '',
        },
        crashReportCount: 42,
      })}
    />
  );
}

export function ChooseGroupMembersPartialPhoneNumber(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.ChooseGroupMembers,
          uuidFetchState: {},
          candidateContacts: [],
          groupSizeRecommendedLimit: 151,
          groupSizeHardLimit: 1001,
          isShowingRecommendedGroupSizeModal: false,
          isShowingMaximumGroupSizeModal: false,
          ourE164: undefined,
          ourUsername: undefined,
          searchTerm: '+1(212) 555',
          username: undefined,
          regionCode: 'US',
          selectedContacts: [],
        },
      })}
    />
  );
}

export function ChooseGroupMembersValidPhoneNumber(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.ChooseGroupMembers,
          uuidFetchState: {},
          candidateContacts: [],
          groupSizeRecommendedLimit: 151,
          groupSizeHardLimit: 1001,
          isShowingRecommendedGroupSizeModal: false,
          isShowingMaximumGroupSizeModal: false,
          ourE164: undefined,
          ourUsername: undefined,
          searchTerm: '+1(212) 555 5454',
          regionCode: 'US',
          selectedContacts: [],
          username: undefined,
        },
      })}
    />
  );
}

export function ChooseGroupMembersUsername(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.ChooseGroupMembers,
          uuidFetchState: {},
          candidateContacts: [],
          groupSizeRecommendedLimit: 151,
          groupSizeHardLimit: 1001,
          isShowingRecommendedGroupSizeModal: false,
          isShowingMaximumGroupSizeModal: false,
          ourE164: undefined,
          ourUsername: undefined,
          searchTerm: 'signal.01',
          regionCode: 'US',
          selectedContacts: [],
          username: 'signal.01',
        },
      })}
    />
  );
}

export function GroupMetadataNoTimer(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.SetGroupMetadata,
          groupAvatar: undefined,
          groupName: 'Group 1',
          groupExpireTimer: DurationInSeconds.ZERO,
          hasError: false,
          isCreating: false,
          isEditingAvatar: false,
          selectedContacts: defaultConversations,
          userAvatarData: [],
        },
      })}
    />
  );
}

export function GroupMetadataRegularTimer(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.SetGroupMetadata,
          groupAvatar: undefined,
          groupName: 'Group 1',
          groupExpireTimer: DurationInSeconds.DAY,
          hasError: false,
          isCreating: false,
          isEditingAvatar: false,
          selectedContacts: defaultConversations,
          userAvatarData: [],
        },
      })}
    />
  );
}

export function GroupMetadataCustomTimer(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          mode: LeftPaneMode.SetGroupMetadata,
          groupAvatar: undefined,
          groupName: 'Group 1',
          groupExpireTimer: DurationInSeconds.fromHours(7),
          hasError: false,
          isCreating: false,
          isEditingAvatar: false,
          selectedContacts: defaultConversations,
          userAvatarData: [],
        },
      })}
    />
  );
}

export function SearchingConversation(): JSX.Element {
  return (
    <LeftPaneInContainer
      {...useProps({
        modeSpecificProps: {
          ...defaultSearchProps,
          mode: LeftPaneMode.Inbox,
          pinnedConversations: [],
          conversations: defaultConversations,
          archivedConversations: [],
          isAboutToSearch: false,
          searchConversation: getDefaultConversation(),
          searchTerm: '',
        },
      })}
    />
  );
}
