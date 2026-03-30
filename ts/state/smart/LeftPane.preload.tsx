// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import type { PropsType as DialogExpiredBuildPropsType } from '../../components/DialogExpiredBuild.dom.tsx';
import { DialogExpiredBuild } from '../../components/DialogExpiredBuild.dom.tsx';
import type { PropsType as LeftPanePropsType } from '../../components/LeftPane.dom.tsx';
import { LeftPane } from '../../components/LeftPane.dom.tsx';
import type { NavTabPanelProps } from '../../components/NavTabs.dom.tsx';
import type { WidthBreakpoint } from '../../components/_util.std.ts';
import {
  getGroupSizeHardLimit,
  getGroupSizeRecommendedLimit,
} from '../../groups/limits.dom.ts';
import { LeftPaneMode } from '../../types/leftPane.std.ts';
import { getUsernameFromSearch } from '../../util/Username.dom.ts';
import { getCountryDataForLocale } from '../../util/getCountryData.dom.ts';
import { lookupConversationWithoutServiceId } from '../../util/lookupConversationWithoutServiceId.preload.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { isDone as isRegistrationDone } from '../../util/registration.preload.ts';
import { drop } from '../../util/drop.std.ts';
import type { ServerAlertsType } from '../../types/ServerAlert.std.ts';
import { getServerAlertToShow } from '../../util/handleServerAlerts.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import {
  ComposerStep,
  OneTimeModalState,
} from '../ducks/conversationsEnums.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useItemsActions } from '../ducks/items.preload.ts';
import { useNetworkActions } from '../ducks/network.dom.ts';
import { useSearchActions } from '../ducks/search.preload.ts';
import { useUsernameActions } from '../ducks/username.preload.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
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
  getShowArchived,
  getTargetedMessage,
  hasGroupCreationError,
  isCreatingGroup,
  isEditingAvatar,
} from '../selectors/conversations.dom.ts';
import {
  getSelectedConversationId,
  getSelectedLocation,
} from '../selectors/nav.std.ts';
import { getCrashReportCount } from '../selectors/crashReports.std.ts';
import { hasExpired } from '../selectors/expiration.dom.ts';
import {
  getBackupMediaDownloadProgress,
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
  getServerAlerts,
  getUsernameCorrupted,
  getUsernameLinkCorrupted,
} from '../selectors/items.dom.ts';
import {
  getChallengeStatus,
  hasNetworkDialog as getHasNetworkDialog,
  getNetworkIsOnline,
} from '../selectors/network.preload.ts';
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
} from '../selectors/search.preload.ts';
import {
  isUpdateDownloaded as getIsUpdateDownloaded,
  isOSUnsupported,
  isUpdateDialogVisible,
} from '../selectors/updates.std.ts';
import {
  getIntl,
  getIsMacOS,
  getRegionCode,
  getTheme,
} from '../selectors/user.std.ts';
import { SmartCaptchaDialog } from './CaptchaDialog.preload.tsx';
import { SmartCrashReportDialog } from './CrashReportDialog.preload.tsx';
import { SmartMessageSearchResult } from './MessageSearchResult.preload.tsx';
import { SmartNetworkStatus } from './NetworkStatus.preload.tsx';
import { SmartRelinkDialog } from './RelinkDialog.dom.tsx';
import {
  renderToastManagerWithoutMegaphone,
  SmartToastManager,
} from './ToastManager.preload.tsx';
import type { SmartPropsType as SmartToastManagerPropsType } from './ToastManager.preload.tsx';
import type { PropsType as SmartUnsupportedOSDialogPropsType } from './UnsupportedOSDialog.preload.tsx';
import { SmartUnsupportedOSDialog } from './UnsupportedOSDialog.preload.tsx';
import { SmartUpdateDialog } from './UpdateDialog.preload.tsx';
import {
  cancelBackupMediaDownload,
  dismissBackupMediaDownloadBanner,
  pauseBackupMediaDownload,
  resumeBackupMediaDownload,
} from '../../util/backupMediaDownload.preload.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { SmartLeftPaneChatFolders } from './LeftPaneChatFolders.preload.tsx';
import { SmartLeftPaneConversationListItemContextMenu } from './LeftPaneConversationListItemContextMenu.preload.tsx';
import type { RenderConversationListItemContextMenuProps } from '../../components/conversationList/BaseConversationListItem.dom.tsx';
import {
  getHasAnyCurrentCustomChatFolders,
  getSelectedChatFolder,
} from '../selectors/chatFolders.std.ts';
import { NavTab, SettingsPage } from '../../types/Nav.std.ts';
import { SmartNotificationProfilesMenu } from './NotificationProfilesMenu.preload.tsx';
import { getActiveProfile } from '../selectors/notificationProfiles.dom.ts';
import type { StateSelector } from '../types.std.ts';

function renderMessageSearchResult(id: string): React.JSX.Element {
  return <SmartMessageSearchResult id={id} />;
}
function renderConversationListItemContextMenu(
  props: RenderConversationListItemContextMenuProps
): React.JSX.Element {
  return <SmartLeftPaneConversationListItemContextMenu {...props} />;
}
function renderNetworkStatus(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): React.JSX.Element {
  return <SmartNetworkStatus {...props} />;
}
function renderRelinkDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): React.JSX.Element {
  return <SmartRelinkDialog {...props} />;
}
function renderUpdateDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): React.JSX.Element {
  return <SmartUpdateDialog {...props} />;
}
function renderCaptchaDialog({
  onSkip,
}: {
  onSkip(): void;
}): React.JSX.Element {
  return <SmartCaptchaDialog onSkip={onSkip} />;
}
function renderCrashReportDialog(): React.JSX.Element {
  return <SmartCrashReportDialog />;
}
function renderExpiredBuildDialog(
  props: DialogExpiredBuildPropsType
): React.JSX.Element {
  return <DialogExpiredBuild {...props} />;
}
function renderLeftPaneChatFolders(): React.JSX.Element {
  return <SmartLeftPaneChatFolders />;
}
function renderUnsupportedOSDialog(
  props: Readonly<SmartUnsupportedOSDialogPropsType>
): React.JSX.Element {
  return <SmartUnsupportedOSDialog {...props} />;
}
function renderToastManagerWithMegaphone(
  props: Readonly<SmartToastManagerPropsType>
): React.JSX.Element {
  return <SmartToastManager {...props} />;
}

function renderNotificationProfilesMenu(): React.JSX.Element {
  return <SmartNotificationProfilesMenu />;
}

type ModeSpecificProps = LeftPanePropsType['modeSpecificProps'];

const getModeSpecificProps: StateSelector<ModeSpecificProps> = createSelector(
  state => state,
  state => {
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
            ...(searchConversation && searchTerm
              ? getSearchResults(state)
              : {}),
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
  }
);

async function saveAlerts(alerts: ServerAlertsType): Promise<void> {
  await itemStorage.put('serverAlerts', alerts);
}

export const SmartLeftPane = memo(function SmartLeftPane({
  hasFailedStorySends,
  hasPendingUpdate,
  otherTabsUnreadStats,
}: NavTabPanelProps) {
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
  const selectedLocation = useSelector(getSelectedLocation);

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
        previousLocation: selectedLocation,
      },
    });
  }, [changeLocation, selectedLocation]);

  const maybePreloadConversation = useCallback(
    (conversationId: string) => {
      if (conversationId !== selectedConversationId) {
        drop(
          window.ConversationController.get(
            conversationId
          )?.preloadNewestMessages()
        );
      }
    },
    [selectedConversationId]
  );

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
      preloadConversation={maybePreloadConversation}
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
      selectedLocation={selectedLocation}
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
