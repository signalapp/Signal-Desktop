// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useCallback, useMemo, useRef } from 'react';
import classNames from 'classnames';
import lodash from 'lodash';

import type { LeftPaneHelper, ToFindType } from './leftPane/LeftPaneHelper.js';
import { FindDirection } from './leftPane/LeftPaneHelper.js';
import type { LeftPaneInboxPropsType } from './leftPane/LeftPaneInboxHelper.js';
import { LeftPaneInboxHelper } from './leftPane/LeftPaneInboxHelper.js';
import type { LeftPaneSearchPropsType } from './leftPane/LeftPaneSearchHelper.js';
import { LeftPaneSearchHelper } from './leftPane/LeftPaneSearchHelper.js';
import type { LeftPaneArchivePropsType } from './leftPane/LeftPaneArchiveHelper.js';
import { LeftPaneArchiveHelper } from './leftPane/LeftPaneArchiveHelper.js';
import type { LeftPaneComposePropsType } from './leftPane/LeftPaneComposeHelper.js';
import { LeftPaneComposeHelper } from './leftPane/LeftPaneComposeHelper.js';
import type { LeftPaneFindByUsernamePropsType } from './leftPane/LeftPaneFindByUsernameHelper.js';
import { LeftPaneFindByUsernameHelper } from './leftPane/LeftPaneFindByUsernameHelper.js';
import type { LeftPaneFindByPhoneNumberPropsType } from './leftPane/LeftPaneFindByPhoneNumberHelper.js';
import { LeftPaneFindByPhoneNumberHelper } from './leftPane/LeftPaneFindByPhoneNumberHelper.js';
import type { LeftPaneChooseGroupMembersPropsType } from './leftPane/LeftPaneChooseGroupMembersHelper.js';
import { LeftPaneChooseGroupMembersHelper } from './leftPane/LeftPaneChooseGroupMembersHelper.js';
import type { LeftPaneSetGroupMetadataPropsType } from './leftPane/LeftPaneSetGroupMetadataHelper.js';
import { LeftPaneSetGroupMetadataHelper } from './leftPane/LeftPaneSetGroupMetadataHelper.js';

import { LeftPaneMode } from '../types/leftPane.js';
import type { LocalizerType, ThemeType } from '../types/Util.js';
import { ScrollBehavior } from '../types/Util.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.js';
import { usePrevious } from '../hooks/usePrevious.js';
import { missingCaseError } from '../util/missingCaseError.js';
import type { DurationInSeconds } from '../util/durations/index.js';
import { WidthBreakpoint, getNavSidebarWidthBreakpoint } from './_util.js';
import * as KeyboardLayout from '../services/keyboardLayout.js';
import type { LookupConversationWithoutServiceIdActionsType } from '../util/lookupConversationWithoutServiceId.js';
import type { ShowConversationType } from '../state/ducks/conversations.js';
import type { PropsType as UnsupportedOSDialogPropsType } from '../state/smart/UnsupportedOSDialog.js';

import { ConversationList } from './ConversationList.js';
import { ContactCheckboxDisabledReason } from './conversationList/ContactCheckbox.js';
import type { PropsType as DialogExpiredBuildPropsType } from './DialogExpiredBuild.js';
import { LeftPaneBanner } from './LeftPaneBanner.js';

import type {
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../types/Avatar.js';
import { useSizeObserver } from '../hooks/useSizeObserver.js';
import {
  NavSidebar,
  NavSidebarActionButton,
  NavSidebarSearchHeader,
} from './NavSidebar.js';
import { ContextMenu } from './ContextMenu.js';
import type { UnreadStats } from '../util/countUnreadStats.js';
import { BackupMediaDownloadProgress } from './BackupMediaDownloadProgress.js';
import type { ServerAlertsType, ServerAlert } from '../types/ServerAlert.js';
import { getServerAlertDialog } from './ServerAlerts.js';
import { NavTab, SettingsPage, ProfileEditorPage } from '../types/Nav.js';
import type { Location } from '../types/Nav.js';
import type { RenderConversationListItemContextMenuProps } from './conversationList/BaseConversationListItem.js';
import type { ExternalProps as NotificationProfilesMenuProps } from '../state/smart/NotificationProfilesMenu.js';
import { ProfileAvatar } from './PreferencesNotificationProfiles.js';
import { tw } from '../axo/tw.js';

const { isNumber } = lodash;

export type PropsType = {
  backupMediaDownloadProgress: {
    isBackupMediaEnabled: boolean;
    totalBytes: number;
    downloadedBytes: number;
    isIdle: boolean;
    isPaused: boolean;
    downloadBannerDismissed: boolean;
  };
  otherTabsUnreadStats: UnreadStats;
  hasExpiredDialog: boolean;
  hasFailedStorySends: boolean;
  hasNetworkDialog: boolean;
  hasPendingUpdate: boolean;
  hasRelinkDialog: boolean;
  hasUpdateDialog: boolean;
  isUpdateDownloaded: boolean;
  isOnline: boolean;
  unsupportedOSDialogType: 'error' | 'warning' | undefined;
  usernameCorrupted: boolean;
  usernameLinkCorrupted: boolean;

  // These help prevent invalid states. For example, we don't need the list of pinned
  //   conversations if we're trying to start a new conversation. Ideally these would be
  //   at the top level, but this is not supported by react-redux + TypeScript.
  modeSpecificProps:
    | ({
        mode: LeftPaneMode.Inbox;
      } & LeftPaneInboxPropsType)
    | ({
        mode: LeftPaneMode.Search;
      } & LeftPaneSearchPropsType)
    | ({
        mode: LeftPaneMode.Archive;
      } & LeftPaneArchivePropsType)
    | ({
        mode: LeftPaneMode.Compose;
      } & LeftPaneComposePropsType)
    | ({
        mode: LeftPaneMode.FindByUsername;
      } & LeftPaneFindByUsernamePropsType)
    | ({
        mode: LeftPaneMode.FindByPhoneNumber;
      } & LeftPaneFindByPhoneNumberPropsType)
    | ({
        mode: LeftPaneMode.ChooseGroupMembers;
      } & LeftPaneChooseGroupMembersPropsType)
    | ({
        mode: LeftPaneMode.SetGroupMetadata;
      } & LeftPaneSetGroupMetadataPropsType);
  getPreferredBadge: PreferredBadgeSelectorType;
  getServerAlertToShow: (alerts: ServerAlertsType) => ServerAlert | null;
  i18n: LocalizerType;
  isMacOS: boolean;
  isNotificationProfileActive: boolean;
  preferredWidthFromStorage: number;
  selectedConversationId: undefined | string;
  targetedMessageId: undefined | string;
  challengeStatus: 'idle' | 'required' | 'pending';
  setChallengeStatus: (status: 'idle') => void;
  crashReportCount: number;
  theme: ThemeType;

  // Action Creators
  blockConversation: (conversationId: string) => void;
  changeLocation: (location: Location) => void;
  clearConversationSearch: () => void;
  clearGroupCreationError: () => void;
  clearSearchQuery: () => void;
  closeMaximumGroupSizeModal: () => void;
  closeRecommendedGroupSizeModal: () => void;
  composeDeleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  composeReplaceAvatar: ReplaceAvatarActionType;
  composeSaveAvatarToDisk: SaveAvatarToDiskActionType;
  createGroup: () => void;
  dismissBackupMediaDownloadBanner: () => void;
  pauseBackupMediaDownload: () => void;
  resumeBackupMediaDownload: () => void;
  cancelBackupMediaDownload: () => void;
  endConversationSearch: () => void;
  endSearch: () => void;
  navTabsCollapsed: boolean;
  openUsernameReservationModal: () => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  removeConversation: (conversationId: string) => void;
  saveAlerts: (alerts: ServerAlertsType) => Promise<void>;
  savePreferredLeftPaneWidth: (_: number) => void;
  searchInConversation: (conversationId: string) => unknown;
  setComposeGroupAvatar: (_: undefined | Uint8Array) => void;
  setComposeGroupExpireTimer: (_: DurationInSeconds) => void;
  setComposeGroupName: (_: string) => void;
  setComposeSearchTerm: (composeSearchTerm: string) => void;
  setComposeSelectedRegion: (newRegion: string) => void;
  serverAlerts?: ServerAlertsType;
  showArchivedConversations: () => void;
  showChooseGroupMembers: () => void;
  showFindByUsername: () => void;
  showFindByPhoneNumber: () => void;
  showConversation: ShowConversationType;
  preloadConversation: (conversationId: string) => void;
  showInbox: () => void;
  startComposing: () => void;
  startSearch: () => unknown;
  startSettingGroupMetadata: () => void;
  toggleComposeEditingAvatar: () => unknown;
  toggleConversationInChooseMembers: (conversationId: string) => void;
  toggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  updateSearchTerm: (query: string) => void;
  updateFilterByUnread: (filterByUnread: boolean) => void;

  // Render Props
  renderMessageSearchResult: (id: string) => JSX.Element;
  renderConversationListItemContextMenu: (
    props: RenderConversationListItemContextMenuProps
  ) => JSX.Element;
  renderNetworkStatus: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderUnsupportedOSDialog: (
    _: Readonly<UnsupportedOSDialogPropsType>
  ) => JSX.Element;
  renderRelinkDialog: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderUpdateDialog: (
    _: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
  ) => JSX.Element;
  renderCaptchaDialog: (props: { onSkip(): void }) => JSX.Element;
  renderCrashReportDialog: () => JSX.Element;
  renderExpiredBuildDialog: (_: DialogExpiredBuildPropsType) => JSX.Element;
  renderLeftPaneChatFolders: () => JSX.Element;
  renderNotificationProfilesMenu: (
    props: NotificationProfilesMenuProps
  ) => JSX.Element;
  renderToastManager: (_: {
    containerWidthBreakpoint: WidthBreakpoint;
  }) => JSX.Element;
} & LookupConversationWithoutServiceIdActionsType;

export function LeftPane({
  backupMediaDownloadProgress,
  otherTabsUnreadStats,
  blockConversation,
  cancelBackupMediaDownload,
  challengeStatus,
  changeLocation,
  clearConversationSearch,
  clearGroupCreationError,
  clearSearchQuery,
  closeMaximumGroupSizeModal,
  closeRecommendedGroupSizeModal,
  composeDeleteAvatarFromDisk,
  composeReplaceAvatar,
  composeSaveAvatarToDisk,
  crashReportCount,
  createGroup,
  endConversationSearch,
  endSearch,
  getPreferredBadge,
  getServerAlertToShow,
  hasExpiredDialog,
  hasFailedStorySends,
  hasNetworkDialog,
  hasPendingUpdate,
  hasRelinkDialog,
  hasUpdateDialog,
  i18n,
  lookupConversationWithoutServiceId,
  isMacOS,
  isNotificationProfileActive,
  isOnline,
  isUpdateDownloaded,
  modeSpecificProps,
  navTabsCollapsed,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,

  openUsernameReservationModal,
  pauseBackupMediaDownload,
  preferredWidthFromStorage,
  preloadConversation,
  removeConversation,
  renderCaptchaDialog,
  renderCrashReportDialog,
  renderExpiredBuildDialog,
  renderLeftPaneChatFolders,
  renderMessageSearchResult,
  renderConversationListItemContextMenu,
  renderNetworkStatus,
  renderNotificationProfilesMenu,
  renderUnsupportedOSDialog,
  renderRelinkDialog,
  renderUpdateDialog,
  renderToastManager,
  resumeBackupMediaDownload,
  saveAlerts,
  savePreferredLeftPaneWidth,
  searchInConversation,
  selectedConversationId,
  targetedMessageId,
  toggleNavTabsCollapse,
  setChallengeStatus,
  setComposeGroupAvatar,
  setComposeGroupExpireTimer,
  setComposeGroupName,
  setComposeSearchTerm,
  setComposeSelectedRegion,
  setIsFetchingUUID,
  showArchivedConversations,
  showChooseGroupMembers,
  showFindByUsername,
  showFindByPhoneNumber,
  showConversation,
  showInbox,
  showUserNotFoundModal,
  serverAlerts,
  startComposing,
  startSearch,
  startSettingGroupMetadata,
  theme,
  toggleComposeEditingAvatar,
  toggleConversationInChooseMembers,
  unsupportedOSDialogType,
  usernameCorrupted,
  usernameLinkCorrupted,
  updateSearchTerm,
  dismissBackupMediaDownloadBanner,
  updateFilterByUnread,
}: PropsType): JSX.Element {
  const previousModeSpecificProps = usePrevious(
    modeSpecificProps,
    modeSpecificProps
  );

  // The left pane can be in various modes: the inbox, the archive, the composer, etc.
  //   Ideally, this would render subcomponents such as `<LeftPaneInbox>` or
  //   `<LeftPaneArchive>` (and if there's a way to do that cleanly, we should refactor
  //   this).
  //
  // But doing that presents two problems:
  //
  // 1. Different components render the same logical inputs (the main header's search),
  //    but React doesn't know that they're the same, so you can lose focus as you change
  //    modes.
  // 2. These components render virtualized lists, which are somewhat slow to initialize.
  //    Switching between modes can cause noticeable hiccups.
  //
  // To get around those problems, we use "helpers" which all correspond to the same
  //   interface.
  //
  // Unfortunately, there's a little bit of repetition here because TypeScript isn't quite
  //   smart enough.
  let helper: LeftPaneHelper<unknown>;
  let shouldRecomputeRowHeights: boolean;
  switch (modeSpecificProps.mode) {
    case LeftPaneMode.Inbox: {
      const inboxHelper = new LeftPaneInboxHelper(modeSpecificProps);
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? inboxHelper.shouldRecomputeRowHeights(previousModeSpecificProps)
          : true;
      helper = inboxHelper;
      break;
    }
    case LeftPaneMode.Search: {
      const searchHelper = new LeftPaneSearchHelper(modeSpecificProps);
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? searchHelper.shouldRecomputeRowHeights(previousModeSpecificProps)
          : true;
      helper = searchHelper;
      break;
    }
    case LeftPaneMode.Archive: {
      const archiveHelper = new LeftPaneArchiveHelper(modeSpecificProps);
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? archiveHelper.shouldRecomputeRowHeights(previousModeSpecificProps)
          : true;
      helper = archiveHelper;
      break;
    }
    case LeftPaneMode.Compose: {
      const composeHelper = new LeftPaneComposeHelper(modeSpecificProps);
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? composeHelper.shouldRecomputeRowHeights(previousModeSpecificProps)
          : true;
      helper = composeHelper;
      break;
    }
    case LeftPaneMode.FindByUsername: {
      const findByUsernameHelper = new LeftPaneFindByUsernameHelper(
        modeSpecificProps
      );
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? findByUsernameHelper.shouldRecomputeRowHeights(
              previousModeSpecificProps
            )
          : true;
      helper = findByUsernameHelper;
      break;
    }
    case LeftPaneMode.FindByPhoneNumber: {
      const findByPhoneNumberHelper = new LeftPaneFindByPhoneNumberHelper(
        modeSpecificProps
      );
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? findByPhoneNumberHelper.shouldRecomputeRowHeights(
              previousModeSpecificProps
            )
          : true;
      helper = findByPhoneNumberHelper;
      break;
    }
    case LeftPaneMode.ChooseGroupMembers: {
      const chooseGroupMembersHelper = new LeftPaneChooseGroupMembersHelper(
        modeSpecificProps
      );
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? chooseGroupMembersHelper.shouldRecomputeRowHeights(
              previousModeSpecificProps
            )
          : true;
      helper = chooseGroupMembersHelper;
      break;
    }
    case LeftPaneMode.SetGroupMetadata: {
      const setGroupMetadataHelper = new LeftPaneSetGroupMetadataHelper(
        modeSpecificProps
      );
      shouldRecomputeRowHeights =
        previousModeSpecificProps.mode === modeSpecificProps.mode
          ? setGroupMetadataHelper.shouldRecomputeRowHeights(
              previousModeSpecificProps
            )
          : true;
      helper = setGroupMetadataHelper;
      break;
    }
    default:
      throw missingCaseError(modeSpecificProps);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { ctrlKey, shiftKey, altKey, metaKey } = event;
      const commandOrCtrl = isMacOS ? metaKey : ctrlKey;
      const key = KeyboardLayout.lookup(event);

      if (key === 'Escape') {
        const backAction = helper.getBackAction({
          showInbox,
          startComposing,
          showChooseGroupMembers,
        });
        if (backAction) {
          event.preventDefault();
          event.stopPropagation();
          backAction();
          return;
        }
      }

      if (
        commandOrCtrl &&
        !shiftKey &&
        !altKey &&
        (key === 'n' || key === 'N')
      ) {
        startComposing();

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      let conversationToOpen:
        | undefined
        | {
            conversationId: string;
            messageId?: string;
          };

      const numericIndex = keyboardKeyToNumericIndex(event.key);
      const openedByNumber = commandOrCtrl && isNumber(numericIndex);
      if (openedByNumber) {
        conversationToOpen =
          helper.getConversationAndMessageAtIndex(numericIndex);
      } else {
        let toFind: undefined | ToFindType;
        if (
          (altKey && !shiftKey && key === 'ArrowUp') ||
          (commandOrCtrl && shiftKey && key === '[') ||
          (ctrlKey && shiftKey && key === 'Tab')
        ) {
          toFind = { direction: FindDirection.Up, unreadOnly: false };
        } else if (
          (altKey && !shiftKey && key === 'ArrowDown') ||
          (commandOrCtrl && shiftKey && key === ']') ||
          (ctrlKey && key === 'Tab')
        ) {
          toFind = { direction: FindDirection.Down, unreadOnly: false };
        } else if (altKey && shiftKey && key === 'ArrowUp') {
          toFind = { direction: FindDirection.Up, unreadOnly: true };
        } else if (altKey && shiftKey && key === 'ArrowDown') {
          toFind = { direction: FindDirection.Down, unreadOnly: true };
        }
        if (toFind) {
          conversationToOpen = helper.getConversationAndMessageInDirection(
            toFind,
            selectedConversationId,
            targetedMessageId
          );
        }
      }

      if (conversationToOpen) {
        const { conversationId, messageId } = conversationToOpen;
        showConversation({ conversationId, messageId });
        if (openedByNumber) {
          clearSearchQuery();
        }
        event.preventDefault();
        event.stopPropagation();
      }

      helper.onKeyDown(event, {
        searchInConversation,
        selectedConversationId,
        startSearch,
      });
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [
    clearSearchQuery,
    helper,
    isMacOS,
    searchInConversation,
    selectedConversationId,
    targetedMessageId,
    showChooseGroupMembers,
    showConversation,
    showInbox,
    startComposing,
    startSearch,
  ]);

  const backgroundNode = helper.getBackgroundNode({
    i18n,
  });

  const preRowsNode = helper.getPreRowsNode({
    clearConversationSearch,
    clearGroupCreationError,
    clearSearchQuery,
    closeMaximumGroupSizeModal,
    closeRecommendedGroupSizeModal,
    composeDeleteAvatarFromDisk,
    composeReplaceAvatar,
    composeSaveAvatarToDisk,
    createGroup,
    i18n,
    removeSelectedContact: toggleConversationInChooseMembers,
    renderLeftPaneChatFolders,
    setComposeGroupAvatar,
    setComposeGroupExpireTimer,
    setComposeGroupName,
    toggleComposeEditingAvatar,
  });
  const footerContents = helper.getFooterContents({
    createGroup,
    i18n,
    startSettingGroupMetadata,
    lookupConversationWithoutServiceId,
    showUserNotFoundModal,
    setIsFetchingUUID,
    showInbox,
    showConversation,
  });

  const getRow = useMemo(() => helper.getRow.bind(helper), [helper]);

  const onSelectConversation = useCallback(
    (conversationId: string, messageId?: string) => {
      showConversation({
        conversationId,
        messageId,
        switchToAssociatedView: true,
      });
    },
    [showConversation]
  );

  // We ensure that the listKey differs between some modes (e.g. inbox/archived), ensuring
  //   that AutoSizer properly detects the new size of its slot in the flexbox. The
  //   archive explainer text at the top of the archive view causes problems otherwise.
  //   It also ensures that we scroll to the top when switching views.
  const listKey = preRowsNode ? 1 : 0;

  const measureRef = useRef<HTMLDivElement>(null);
  const measureSize = useSizeObserver(measureRef);

  const previousMeasureSize = usePrevious(null, measureSize);

  const widthBreakpoint = getNavSidebarWidthBreakpoint(
    measureSize?.width ?? preferredWidthFromStorage
  );

  const commonDialogProps = {
    i18n,
    containerWidthBreakpoint: widthBreakpoint,
  };

  // Control scroll position
  const previousSelectedConversationId = usePrevious(
    selectedConversationId,
    selectedConversationId
  );

  const isScrollable = helper.isScrollable();

  let rowIndexToScrollTo: undefined | number;
  let scrollBehavior: ScrollBehavior;

  const hasChangedModes =
    previousModeSpecificProps?.mode !== modeSpecificProps.mode;

  const hasSwitchedToInbox =
    hasChangedModes && modeSpecificProps.mode === LeftPaneMode.Inbox;

  const hasChangedConversations =
    previousSelectedConversationId !== selectedConversationId;

  const hasJustMounted = previousMeasureSize == null;
  if (isScrollable) {
    const rowIndexForSelectedConversation = helper.getRowIndexToScrollTo(
      selectedConversationId
    );
    if (hasSwitchedToInbox) {
      rowIndexToScrollTo = rowIndexForSelectedConversation;
    } else if (
      modeSpecificProps.mode === LeftPaneMode.Inbox &&
      (hasChangedConversations || hasJustMounted)
    ) {
      rowIndexToScrollTo = rowIndexForSelectedConversation;
    } else if (hasChangedModes) {
      rowIndexToScrollTo = 0;
    }
    scrollBehavior = ScrollBehavior.Default;
  } else {
    rowIndexToScrollTo = 0;
    scrollBehavior = ScrollBehavior.Hard;
  }

  const maybeServerAlert = getServerAlertDialog(
    serverAlerts,
    getServerAlertToShow,
    saveAlerts,
    commonDialogProps
  );
  // Yellow dialogs
  let maybeYellowDialog: JSX.Element | undefined;

  if (unsupportedOSDialogType === 'warning') {
    maybeYellowDialog = renderUnsupportedOSDialog({
      type: 'warning',
      ...commonDialogProps,
    });
  } else if (hasNetworkDialog) {
    maybeYellowDialog = renderNetworkStatus(commonDialogProps);
  } else if (hasRelinkDialog) {
    maybeYellowDialog = renderRelinkDialog(commonDialogProps);
  } else if (maybeServerAlert) {
    maybeYellowDialog = maybeServerAlert;
  }

  // Update dialog
  let maybeUpdateDialog: JSX.Element | undefined;
  if (hasUpdateDialog && (!hasNetworkDialog || isUpdateDownloaded)) {
    maybeUpdateDialog = renderUpdateDialog(commonDialogProps);
  }

  // Red dialogs
  let maybeRedDialog: JSX.Element | undefined;
  if (unsupportedOSDialogType === 'error') {
    maybeRedDialog = renderUnsupportedOSDialog({
      type: 'error',
      ...commonDialogProps,
    });
  } else if (hasExpiredDialog) {
    maybeRedDialog = renderExpiredBuildDialog(commonDialogProps);
  }

  const dialogs = new Array<{ key: string; dialog: JSX.Element }>();

  if (maybeRedDialog) {
    dialogs.push({ key: 'red', dialog: maybeRedDialog });
    if (maybeUpdateDialog) {
      dialogs.push({ key: 'update', dialog: maybeUpdateDialog });
    } else if (maybeYellowDialog) {
      dialogs.push({ key: 'yellow', dialog: maybeYellowDialog });
    }
  } else {
    if (maybeUpdateDialog) {
      dialogs.push({ key: 'update', dialog: maybeUpdateDialog });
    }
    if (maybeYellowDialog) {
      dialogs.push({ key: 'yellow', dialog: maybeYellowDialog });
    }
  }

  let maybeBanner: JSX.Element | undefined;
  if (usernameCorrupted) {
    maybeBanner = (
      <LeftPaneBanner
        actionText={i18n('icu:LeftPane--corrupted-username--action-text')}
        onClick={() => {
          openUsernameReservationModal();
          changeLocation({
            tab: NavTab.Settings,
            details: {
              page: SettingsPage.Profile,
              state: ProfileEditorPage.Username,
            },
          });
        }}
      >
        {i18n('icu:LeftPane--corrupted-username--text')}
      </LeftPaneBanner>
    );
  } else if (usernameLinkCorrupted) {
    maybeBanner = (
      <LeftPaneBanner
        actionText={i18n('icu:LeftPane--corrupted-username-link--action-text')}
        onClick={() => {
          changeLocation({
            tab: NavTab.Settings,
            details: {
              page: SettingsPage.Profile,
              state: ProfileEditorPage.UsernameLink,
            },
          });
        }}
      >
        {i18n('icu:LeftPane--corrupted-username-link--text')}
      </LeftPaneBanner>
    );
  }

  if (maybeBanner) {
    dialogs.push({ key: 'banner', dialog: maybeBanner });
  }

  const hideHeader =
    modeSpecificProps.mode === LeftPaneMode.Archive ||
    modeSpecificProps.mode === LeftPaneMode.Compose ||
    modeSpecificProps.mode === LeftPaneMode.FindByUsername ||
    modeSpecificProps.mode === LeftPaneMode.FindByPhoneNumber ||
    modeSpecificProps.mode === LeftPaneMode.ChooseGroupMembers ||
    modeSpecificProps.mode === LeftPaneMode.SetGroupMetadata;

  const showBackupMediaDownloadProgress =
    !hideHeader &&
    backupMediaDownloadProgress.isBackupMediaEnabled &&
    !backupMediaDownloadProgress.downloadBannerDismissed;

  const hasDialogs = dialogs.length ? !hideHeader : false;

  // The notification profile menu shows in two places - under its own icon and
  // under the more actions context menu.
  const [isNotificationProfilesMenuOpen, setIsNotificationProfilesMenuOpen] =
    React.useState(false);
  const [
    isNotificationProfilesSubMenuOpen,
    setIsNotificationProfilesSubMenuOpen,
  ] = React.useState(false);

  React.useEffect(() => {
    if (!isNotificationProfileActive) {
      setIsNotificationProfilesMenuOpen(false);
    }
  }, [isNotificationProfileActive, setIsNotificationProfilesMenuOpen]);

  return (
    <NavSidebar
      title={i18n('icu:LeftPane--chats')}
      hideHeader={hideHeader}
      i18n={i18n}
      otherTabsUnreadStats={otherTabsUnreadStats}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      navTabsCollapsed={navTabsCollapsed}
      onToggleNavTabsCollapse={toggleNavTabsCollapse}
      preferredLeftPaneWidth={preferredWidthFromStorage}
      requiresFullWidth={helper.requiresFullWidth()}
      savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
      renderToastManager={renderToastManager}
      actions={
        <>
          {isNotificationProfileActive &&
            renderNotificationProfilesMenu({
              isOpen: isNotificationProfilesMenuOpen,
              onClose: () => {
                setIsNotificationProfilesMenuOpen(false);
              },
              trigger: (
                <button
                  className={tw(
                    'rounded-sm focus:outline-none focus-visible:shadow-legacy-outline'
                  )}
                  type="button"
                  onClick={() => setIsNotificationProfilesMenuOpen(true)}
                  onKeyUp={(event: React.KeyboardEvent<HTMLButtonElement>) => {
                    if (event.code === 'Enter' || event.code === 'Space') {
                      setIsNotificationProfilesMenuOpen(true);
                    }
                  }}
                >
                  <ProfileAvatar i18n={i18n} size="medium-small" />
                </button>
              ),
            })}
          <NavSidebarActionButton
            label={i18n('icu:newConversation')}
            icon={<span className="module-left-pane__startComposingIcon" />}
            onClick={startComposing}
          />
          <ContextMenu
            i18n={i18n}
            menuOptions={[
              {
                label: i18n('icu:avatarMenuViewArchive'),
                onClick: showArchivedConversations,
              },
              {
                label: i18n('icu:NotificationProfileMenuItem'),
                onClick: () => setIsNotificationProfilesSubMenuOpen(true),
              },
            ]}
            popperOptions={{
              placement: 'bottom',
              strategy: 'absolute',
            }}
            portalToRoot
          >
            {({ onClick, onKeyDown, ref }) =>
              renderNotificationProfilesMenu({
                isOpen: isNotificationProfilesSubMenuOpen,
                onClose: () => {
                  setIsNotificationProfilesSubMenuOpen(false);
                },
                trigger: (
                  <NavSidebarActionButton
                    ref={ref}
                    onClick={onClick}
                    onKeyDown={onKeyDown}
                    icon={
                      <span className="module-left-pane__moreActionsIcon" />
                    }
                    label="More Actions"
                  />
                ),
              })
            }
          </ContextMenu>
        </>
      }
    >
      {backgroundNode}
      <nav
        className={classNames(
          'module-left-pane',
          modeSpecificProps.mode === LeftPaneMode.ChooseGroupMembers &&
            'module-left-pane--mode-choose-group-members',
          modeSpecificProps.mode === LeftPaneMode.Compose &&
            'module-left-pane--mode-compose'
        )}
      >
        <div className="module-left-pane__header">
          {helper.getHeaderContents({
            i18n,
            showInbox,
            startComposing,
            showChooseGroupMembers,
          })}
        </div>
        {(widthBreakpoint === WidthBreakpoint.Wide ||
          modeSpecificProps.mode !== LeftPaneMode.Inbox) && (
          <NavSidebarSearchHeader>
            {helper.getSearchInput({
              clearConversationSearch,
              clearSearchQuery,
              endConversationSearch,
              endSearch,
              i18n,
              onChangeComposeSearchTerm: event => {
                setComposeSearchTerm(event.target.value);
              },
              updateSearchTerm,
              onChangeComposeSelectedRegion: setComposeSelectedRegion,
              showConversation,
              lookupConversationWithoutServiceId,
              showUserNotFoundModal,
              setIsFetchingUUID,
              showInbox,
              updateFilterByUnread,
            })}
          </NavSidebarSearchHeader>
        )}

        {hasDialogs ? (
          <div className="module-left-pane__dialogs">
            {dialogs.map(({ key, dialog }) => (
              <React.Fragment key={key}>{dialog}</React.Fragment>
            ))}
          </div>
        ) : null}
        {showBackupMediaDownloadProgress ? (
          <BackupMediaDownloadProgress
            i18n={i18n}
            widthBreakpoint={widthBreakpoint}
            isOnline={isOnline}
            {...backupMediaDownloadProgress}
            handleClose={dismissBackupMediaDownloadBanner}
            handlePause={pauseBackupMediaDownload}
            handleResume={resumeBackupMediaDownload}
            handleCancel={cancelBackupMediaDownload}
          />
        ) : null}
        {preRowsNode && <React.Fragment key={0}>{preRowsNode}</React.Fragment>}
        <div className="module-left-pane__list--measure" ref={measureRef}>
          <div className="module-left-pane__list--wrapper">
            <div
              aria-live="polite"
              className="module-left-pane__list"
              data-supertab
              key={listKey}
              role="presentation"
              tabIndex={-1}
            >
              <ConversationList
                key={modeSpecificProps.mode}
                dimensions={measureSize ?? undefined}
                getPreferredBadge={getPreferredBadge}
                getRow={getRow}
                i18n={i18n}
                hasDialogPadding={hasDialogs}
                onClickArchiveButton={showArchivedConversations}
                onClickContactCheckbox={(
                  conversationId: string,
                  disabledReason: undefined | ContactCheckboxDisabledReason
                ) => {
                  switch (disabledReason) {
                    case undefined:
                      toggleConversationInChooseMembers(conversationId);
                      break;
                    case ContactCheckboxDisabledReason.AlreadyAdded:
                    case ContactCheckboxDisabledReason.MaximumContactsSelected:
                      // These are no-ops.
                      break;
                    default:
                      throw missingCaseError(disabledReason);
                  }
                }}
                onClickClearFilterButton={() => {
                  updateFilterByUnread(false);
                }}
                showUserNotFoundModal={showUserNotFoundModal}
                setIsFetchingUUID={setIsFetchingUUID}
                lookupConversationWithoutServiceId={
                  lookupConversationWithoutServiceId
                }
                showConversation={showConversation}
                blockConversation={blockConversation}
                onPreloadConversation={preloadConversation}
                onSelectConversation={onSelectConversation}
                onOutgoingAudioCallInConversation={
                  onOutgoingAudioCallInConversation
                }
                onOutgoingVideoCallInConversation={
                  onOutgoingVideoCallInConversation
                }
                removeConversation={removeConversation}
                renderMessageSearchResult={renderMessageSearchResult}
                renderConversationListItemContextMenu={
                  renderConversationListItemContextMenu
                }
                rowCount={helper.getRowCount()}
                scrollBehavior={scrollBehavior}
                scrollToRowIndex={rowIndexToScrollTo}
                scrollable={isScrollable}
                shouldRecomputeRowHeights={shouldRecomputeRowHeights}
                showChooseGroupMembers={showChooseGroupMembers}
                showFindByUsername={showFindByUsername}
                showFindByPhoneNumber={showFindByPhoneNumber}
                theme={theme}
              />
            </div>
          </div>
        </div>
        {footerContents && (
          <div className="module-left-pane__footer">{footerContents}</div>
        )}

        {challengeStatus !== 'idle' &&
          renderCaptchaDialog({
            onSkip() {
              setChallengeStatus('idle');
            },
          })}
        {crashReportCount > 0 && renderCrashReportDialog()}
      </nav>
    </NavSidebar>
  );
}

function keyboardKeyToNumericIndex(key: string): undefined | number {
  if (key.length !== 1) {
    return undefined;
  }
  const result = parseInt(key, 10) - 1;
  const isValidIndex = Number.isInteger(result) && result >= 0 && result <= 8;
  return isValidIndex ? result : undefined;
}
