// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { PropsType as DialogExpiredBuildPropsType } from '../../components/DialogExpiredBuild.dom.js';
import { DialogExpiredBuild } from '../../components/DialogExpiredBuild.dom.js';
import type { PropsType as LeftPanePropsType } from '../../components/LeftPane.dom.js';
import { LeftPane } from '../../components/LeftPane.dom.js';
import type { NavTabPanelProps } from '../../components/NavTabs.dom.js';
import type { WidthBreakpoint } from '../../components/_util.std.js';
import {
  getGroupSizeHardLimit,
  getGroupSizeRecommendedLimit,
} from '../../groups/limits.dom.js';
import { LeftPaneMode } from '../../types/leftPane.std.js';
import { getUsernameFromSearch } from '../../util/Username.dom.js';
import { getCountryDataForLocale } from '../../util/getCountryData.dom.js';
import { isChatFoldersEnabled } from '../../util/isChatFoldersEnabled.dom.js';
import { lookupConversationWithoutServiceId } from '../../util/lookupConversationWithoutServiceId.preload.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { isDone as isRegistrationDone } from '../../util/registration.preload.js';
import { drop } from '../../util/drop.std.js';
import type { ServerAlertsType } from '../../types/ServerAlert.std.js';
import { getServerAlertToShow } from '../../util/handleServerAlerts.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import {
  ComposerStep,
  OneTimeModalState,
} from '../ducks/conversationsEnums.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useItemsActions } from '../ducks/items.preload.js';
import { useNetworkActions } from '../ducks/network.dom.js';
import { useSearchActions } from '../ducks/search.preload.js';
import { useUsernameActions } from '../ducks/username.preload.js';
import type { StateType } from '../reducer.preload.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import {
  getComposeAvatarData,
  getComposeGroupAvatar,
  getComposeGroupExpireTimer,
  getComposeGroupName,
  getComposeSelectedContacts,
  getComposerConversationSearchTerm,
  getComposerSelectedRegion,
  getComposerStep,
  getComposerUUIDFetchState,
  getFilteredCandidateContactsForNewGroup,
  getFilteredComposeContacts,
  getFilteredComposeGroups,
  getLeftPaneLists,
  getMaximumGroupSizeModalState,
  getMe,
  getRecommendedGroupSizeModalState,
  getSelectedConversationId,
  getShowArchived,
  getTargetedMessage,
  hasGroupCreationError,
  isCreatingGroup,
  isEditingAvatar,
} from '../selectors/conversations.dom.js';
import { getCrashReportCount } from '../selectors/crashReports.std.js';
import { hasExpired } from '../selectors/expiration.dom.js';
import {
  getBackupMediaDownloadProgress,
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
  getServerAlerts,
  getUsernameCorrupted,
  getUsernameLinkCorrupted,
} from '../selectors/items.dom.js';
import {
  getChallengeStatus,
  hasNetworkDialog as getHasNetworkDialog,
  getNetworkIsOnline,
} from '../selectors/network.preload.js';
import {
  getFilterByUnread,
  getHasSearchQuery,
  getIsActivelySearching,
  getIsSearching,
  getIsSearchingGlobally,
  getQuery,
  getSearchConversation,
  getSearchResults,
  getStartSearchCounter,
} from '../selectors/search.dom.js';
import {
  isUpdateDownloaded as getIsUpdateDownloaded,
  isOSUnsupported,
  isUpdateDialogVisible,
} from '../selectors/updates.std.js';
import {
  getIntl,
  getIsMacOS,
  getRegionCode,
  getTheme,
} from '../selectors/user.std.js';
import { SmartCaptchaDialog } from './CaptchaDialog.preload.js';
import { SmartCrashReportDialog } from './CrashReportDialog.preload.js';
import { SmartMessageSearchResult } from './MessageSearchResult.preload.js';
import { SmartNetworkStatus } from './NetworkStatus.preload.js';
import { SmartRelinkDialog } from './RelinkDialog.dom.js';
import { SmartToastManager } from './ToastManager.preload.js';
import type { PropsType as SmartUnsupportedOSDialogPropsType } from './UnsupportedOSDialog.preload.js';
import { SmartUnsupportedOSDialog } from './UnsupportedOSDialog.preload.js';
import { SmartUpdateDialog } from './UpdateDialog.preload.js';
import {
  cancelBackupMediaDownload,
  dismissBackupMediaDownloadBanner,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
} from '../../util/backupMediaDownload.preload.js';
import { useNavActions } from '../ducks/nav.std.js';
import { SmartLeftPaneChatFolders } from './LeftPaneChatFolders.preload.js';
import { SmartLeftPaneConversationListItemContextMenu } from './LeftPaneConversationListItemContextMenu.preload.js';
import type { RenderConversationListItemContextMenuProps } from '../../components/conversationList/BaseConversationListItem.dom.js';
import {
  getHasAnyCurrentCustomChatFolders,
  getSelectedChatFolder,
} from '../selectors/chatFolders.std.js';
import { NavTab, SettingsPage } from '../../types/Nav.std.js';
import { SmartNotificationProfilesMenu } from './NotificationProfilesMenu.preload.js';
import { getActiveProfile } from '../selectors/notificationProfiles.dom.js';

function renderMessageSearchResult(id: string): JSX.Element {
  return <SmartMessageSearchResult id={id} />;
}
function renderConversationListItemContextMenu(
  props: RenderConversationListItemContextMenuProps
): JSX.Element {
  return <SmartLeftPaneConversationListItemContextMenu {...props} />;
}
function renderNetworkStatus(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartNetworkStatus {...props} />;
}
function renderRelinkDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartRelinkDialog {...props} />;
}
function renderUpdateDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartUpdateDialog {...props} />;
}
function renderCaptchaDialog({ onSkip }: { onSkip(): void }): JSX.Element {
  return <SmartCaptchaDialog onSkip={onSkip} />;
}
function renderCrashReportDialog(): JSX.Element {
  return <SmartCrashReportDialog />;
}
function renderExpiredBuildDialog(
  props: DialogExpiredBuildPropsType
): JSX.Element {
  return <DialogExpiredBuild {...props} />;
}
function renderLeftPaneChatFolders(): JSX.Element {
  return <SmartLeftPaneChatFolders />;
}
function renderUnsupportedOSDialog(
  props: Readonly<SmartUnsupportedOSDialogPropsType>
): JSX.Element {
  return <SmartUnsupportedOSDialog {...props} />;
}
function renderToastManagerWithMegaphone(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): JSX.Element {
  return <SmartToastManager {...props} />;
}

function renderToastManagerWithoutMegaphone(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): JSX.Element {
  return <SmartToastManager disableMegaphone {...props} />;
}

function renderNotificationProfilesMenu(): JSX.Element {
  return <SmartNotificationProfilesMenu />;
}

const getModeSpecificProps = (
  state: StateType
): LeftPanePropsType['modeSpecificProps'] => {
  const i18n = getIntl(state);
  const composerStep = getComposerStep(state);
  switch (composerStep) {
    case undefined:
      if (getShowArchived(state)) {
        const { archivedConversations } = getLeftPaneLists(state);
        const searchConversation = getSearchConversation(state);
        const searchTerm = getQuery(state);
        return {
          mode: LeftPaneMode.Archive,
          archivedConversations,
          isSearchingGlobally: getIsSearchingGlobally(state),
          searchConversation,
          searchTerm,
          startSearchCounter: getStartSearchCounter(state),
          ...(searchConversation && searchTerm ? getSearchResults(state) : {}),
        };
      }
      if (getIsActivelySearching(state)) {
        return {
          mode: LeftPaneMode.Search,
          isSearchingGlobally: getIsSearchingGlobally(state),
          searchConversation: getSearchConversation(state),
          searchDisabled: state.network.challengeStatus !== 'idle',
          startSearchCounter: getStartSearchCounter(state),
          ...getSearchResults(state),
        };
      }
      return {
        mode: LeftPaneMode.Inbox,
        isAboutToSearch: getIsSearching(state),
        isSearchingGlobally: getIsSearchingGlobally(state),
        searchConversation: getSearchConversation(state),
        searchDisabled: state.network.challengeStatus !== 'idle',
        searchTerm: getQuery(state),
        startSearchCounter: getStartSearchCounter(state),
        filterByUnread: getFilterByUnread(state),
        selectedChatFolder: getSelectedChatFolder(state),
        ...getLeftPaneLists(state),
      };
    case ComposerStep.StartDirectConversation:
      return {
        mode: LeftPaneMode.Compose,
        composeContacts: getFilteredComposeContacts(state),
        composeGroups: getFilteredComposeGroups(state),
        regionCode: getRegionCode(state),
        searchTerm: getComposerConversationSearchTerm(state),
        uuidFetchState: getComposerUUIDFetchState(state),
        username: getUsernameFromSearch(
          getComposerConversationSearchTerm(state)
        ),
      };
    case ComposerStep.FindByUsername:
      return {
        mode: LeftPaneMode.FindByUsername,
        searchTerm: getComposerConversationSearchTerm(state),
        uuidFetchState: getComposerUUIDFetchState(state),
        username: getUsernameFromSearch(
          getComposerConversationSearchTerm(state)
        ),
      };
    case ComposerStep.FindByPhoneNumber:
      return {
        mode: LeftPaneMode.FindByPhoneNumber,
        searchTerm: getComposerConversationSearchTerm(state),
        regionCode: getRegionCode(state),
        uuidFetchState: getComposerUUIDFetchState(state),
        countries: getCountryDataForLocale(i18n.getLocale()),
        selectedRegion: getComposerSelectedRegion(state),
      };
    case ComposerStep.ChooseGroupMembers:
      return {
        mode: LeftPaneMode.ChooseGroupMembers,
        candidateContacts: getFilteredCandidateContactsForNewGroup(state),
        groupSizeRecommendedLimit: getGroupSizeRecommendedLimit(),
        groupSizeHardLimit: getGroupSizeHardLimit(),
        isShowingRecommendedGroupSizeModal:
          getRecommendedGroupSizeModalState(state) ===
          OneTimeModalState.Showing,
        isShowingMaximumGroupSizeModal:
          getMaximumGroupSizeModalState(state) === OneTimeModalState.Showing,
        ourE164: getMe(state).e164,
        ourUsername: getMe(state).username,
        regionCode: getRegionCode(state),
        searchTerm: getComposerConversationSearchTerm(state),
        selectedContacts: getComposeSelectedContacts(state),
        uuidFetchState: getComposerUUIDFetchState(state),
        username: getUsernameFromSearch(
          getComposerConversationSearchTerm(state)
        ),
      };
    case ComposerStep.SetGroupMetadata:
      return {
        mode: LeftPaneMode.SetGroupMetadata,
        groupAvatar: getComposeGroupAvatar(state),
        groupName: getComposeGroupName(state),
        groupExpireTimer: getComposeGroupExpireTimer(state),
        hasError: hasGroupCreationError(state),
        isCreating: isCreatingGroup(state),
        isEditingAvatar: isEditingAvatar(state),
        selectedContacts: getComposeSelectedContacts(state),
        userAvatarData: getComposeAvatarData(state),
      };
    default:
      throw missingCaseError(composerStep);
  }
};

function preloadConversation(conversationId: string): void {
  drop(
    window.ConversationController.get(conversationId)?.preloadNewestMessages()
  );
}

async function saveAlerts(alerts: ServerAlertsType): Promise<void> {
  await itemStorage.put('serverAlerts', alerts);
}

export const SmartLeftPane = memo(function SmartLeftPane({
  hasFailedStorySends,
  hasPendingUpdate,
  otherTabsUnreadStats,
}: NavTabPanelProps) {
  const version = window.SignalContext.getVersion();
  const challengeStatus = useSelector(getChallengeStatus);
  const composerStep = useSelector(getComposerStep);
  const crashReportCount = useSelector(getCrashReportCount);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const hasAppExpired = useSelector(hasExpired);
  const hasAnyCurrentCustomChatFolders = useSelector(
    getHasAnyCurrentCustomChatFolders
  );
  const hasNetworkDialog = useSelector(getHasNetworkDialog);
  const hasSearchQuery = useSelector(getHasSearchQuery);
  const hasUnsupportedOS = useSelector(isOSUnsupported);
  const hasUpdateDialog = useSelector(isUpdateDialogVisible);
  const i18n = useSelector(getIntl);
  const isMacOS = useSelector(getIsMacOS);
  const isUpdateDownloaded = useSelector(getIsUpdateDownloaded);
  const modeSpecificProps = useSelector(getModeSpecificProps);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const preferredWidthFromStorage = useSelector(getPreferredLeftPaneWidth);
  const selectedChatFolder = useSelector(getSelectedChatFolder);
  const selectedConversationId = useSelector(getSelectedConversationId);
  const showArchived = useSelector(getShowArchived);
  const targetedMessage = useSelector(getTargetedMessage);
  const theme = useSelector(getTheme);
  const usernameCorrupted = useSelector(getUsernameCorrupted);
  const usernameLinkCorrupted = useSelector(getUsernameLinkCorrupted);
  const backupMediaDownloadProgress = useSelector(
    getBackupMediaDownloadProgress
  );
  const isOnline = useSelector(getNetworkIsOnline);

  const serverAlerts = useSelector(getServerAlerts);

  const {
    blockConversation,
    clearGroupCreationError,
    closeMaximumGroupSizeModal,
    closeRecommendedGroupSizeModal,
    composeDeleteAvatarFromDisk,
    composeReplaceAvatar,
    composeSaveAvatarToDisk,
    createGroup,
    removeConversation,
    setComposeGroupAvatar,
    setComposeGroupExpireTimer,
    setComposeGroupName,
    setComposeSearchTerm,
    setComposeSelectedRegion,
    setIsFetchingUUID,
    showArchivedConversations,
    showChooseGroupMembers,
    showConversation,
    showFindByPhoneNumber,
    showFindByUsername,
    showInbox,
    startComposing,
    startSettingGroupMetadata,
    toggleComposeEditingAvatar,
    toggleConversationInChooseMembers,
  } = useConversationsActions();
  const {
    clearConversationSearch,
    clearSearchQuery,
    endConversationSearch,
    endSearch,
    searchInConversation,
    startSearch,
    updateSearchTerm,
    updateFilterByUnread,
  } = useSearchActions();
  const {
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
  } = useCallingActions();
  const { openUsernameReservationModal } = useUsernameActions();
  const { savePreferredLeftPaneWidth, toggleNavTabsCollapse } =
    useItemsActions();
  const { setChallengeStatus } = useNetworkActions();
  const { showUserNotFoundModal } = useGlobalModalActions();
  const { changeLocation } = useNavActions();

  const handleChatFolderOpenSettings = useCallback(() => {
    changeLocation({
      tab: NavTab.Settings,
      details: {
        page: SettingsPage.ChatFolders,
        previousLocation: {
          tab: NavTab.Chats,
        },
      },
    });
  }, [changeLocation]);

  let hasExpiredDialog = false;
  let unsupportedOSDialogType: 'error' | 'warning' | undefined;
  if (hasAppExpired) {
    if (hasUnsupportedOS) {
      unsupportedOSDialogType = 'error';
    } else {
      hasExpiredDialog = true;
    }
  } else if (hasUnsupportedOS) {
    unsupportedOSDialogType = 'warning';
  }

  const hasRelinkDialog = !isRegistrationDone();

  const renderToastManager =
    composerStep == null && !showArchived && !hasSearchQuery
      ? renderToastManagerWithMegaphone
      : renderToastManagerWithoutMegaphone;

  const targetedMessageId = targetedMessage?.id;
  const isNotificationProfileActive = Boolean(useSelector(getActiveProfile));

  return (
    <LeftPane
      backupMediaDownloadProgress={backupMediaDownloadProgress}
      blockConversation={blockConversation}
      cancelBackupMediaDownload={cancelBackupMediaDownload}
      challengeStatus={challengeStatus}
      changeLocation={changeLocation}
      clearConversationSearch={clearConversationSearch}
      clearGroupCreationError={clearGroupCreationError}
      clearSearchQuery={clearSearchQuery}
      closeMaximumGroupSizeModal={closeMaximumGroupSizeModal}
      closeRecommendedGroupSizeModal={closeRecommendedGroupSizeModal}
      composeDeleteAvatarFromDisk={composeDeleteAvatarFromDisk}
      composeReplaceAvatar={composeReplaceAvatar}
      composeSaveAvatarToDisk={composeSaveAvatarToDisk}
      crashReportCount={crashReportCount}
      createGroup={createGroup}
      dismissBackupMediaDownloadBanner={dismissBackupMediaDownloadBanner}
      endConversationSearch={endConversationSearch}
      endSearch={endSearch}
      getPreferredBadge={getPreferredBadge}
      getServerAlertToShow={getServerAlertToShow}
      hasAnyCurrentCustomChatFolders={hasAnyCurrentCustomChatFolders}
      hasExpiredDialog={hasExpiredDialog}
      hasFailedStorySends={hasFailedStorySends}
      hasNetworkDialog={hasNetworkDialog}
      hasPendingUpdate={hasPendingUpdate}
      hasRelinkDialog={hasRelinkDialog}
      hasUpdateDialog={hasUpdateDialog}
      i18n={i18n}
      isMacOS={isMacOS}
      isOnline={isOnline}
      isNotificationProfileActive={isNotificationProfileActive}
      isChatFoldersEnabled={isChatFoldersEnabled(version)}
      isUpdateDownloaded={isUpdateDownloaded}
      lookupConversationWithoutServiceId={lookupConversationWithoutServiceId}
      modeSpecificProps={modeSpecificProps}
      navTabsCollapsed={navTabsCollapsed}
      onChatFoldersOpenSettings={handleChatFolderOpenSettings}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      openUsernameReservationModal={openUsernameReservationModal}
      otherTabsUnreadStats={otherTabsUnreadStats}
      pauseBackupMediaDownload={pauseBackupMediaDownload}
      preferredWidthFromStorage={preferredWidthFromStorage}
      preloadConversation={preloadConversation}
      removeConversation={removeConversation}
      renderCaptchaDialog={renderCaptchaDialog}
      renderCrashReportDialog={renderCrashReportDialog}
      renderExpiredBuildDialog={renderExpiredBuildDialog}
      renderLeftPaneChatFolders={renderLeftPaneChatFolders}
      renderMessageSearchResult={renderMessageSearchResult}
      renderConversationListItemContextMenu={
        renderConversationListItemContextMenu
      }
      renderNetworkStatus={renderNetworkStatus}
      renderNotificationProfilesMenu={renderNotificationProfilesMenu}
      renderRelinkDialog={renderRelinkDialog}
      renderToastManager={renderToastManager}
      renderUnsupportedOSDialog={renderUnsupportedOSDialog}
      renderUpdateDialog={renderUpdateDialog}
      resumeBackupMediaDownload={resumeBackupMediaDownload}
      saveAlerts={saveAlerts}
      savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
      searchInConversation={searchInConversation}
      selectedChatFolder={selectedChatFolder}
      selectedConversationId={selectedConversationId}
      serverAlerts={serverAlerts}
      setChallengeStatus={setChallengeStatus}
      setComposeGroupAvatar={setComposeGroupAvatar}
      setComposeGroupExpireTimer={setComposeGroupExpireTimer}
      setComposeGroupName={setComposeGroupName}
      setComposeSearchTerm={setComposeSearchTerm}
      setComposeSelectedRegion={setComposeSelectedRegion}
      setIsFetchingUUID={setIsFetchingUUID}
      showArchivedConversations={showArchivedConversations}
      showChooseGroupMembers={showChooseGroupMembers}
      showConversation={showConversation}
      showFindByPhoneNumber={showFindByPhoneNumber}
      showFindByUsername={showFindByUsername}
      showInbox={showInbox}
      showUserNotFoundModal={showUserNotFoundModal}
      startComposing={startComposing}
      startSearch={startSearch}
      startSettingGroupMetadata={startSettingGroupMetadata}
      targetedMessageId={targetedMessageId}
      theme={theme}
      toggleComposeEditingAvatar={toggleComposeEditingAvatar}
      toggleConversationInChooseMembers={toggleConversationInChooseMembers}
      toggleNavTabsCollapse={toggleNavTabsCollapse}
      unsupportedOSDialogType={unsupportedOSDialogType}
      updateSearchTerm={updateSearchTerm}
      usernameCorrupted={usernameCorrupted}
      usernameLinkCorrupted={usernameLinkCorrupted}
      updateFilterByUnread={updateFilterByUnread}
    />
  );
});
