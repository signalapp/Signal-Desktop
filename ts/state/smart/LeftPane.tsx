// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { get } from 'lodash';
import { mapDispatchToProps } from '../actions';
import type { PropsType as LeftPanePropsType } from '../../components/LeftPane';
import { LeftPane } from '../../components/LeftPane';
import { DialogExpiredBuild } from '../../components/DialogExpiredBuild';
import type { PropsType as DialogExpiredBuildPropsType } from '../../components/DialogExpiredBuild';
import type { StateType } from '../reducer';
import { missingCaseError } from '../../util/missingCaseError';
import { lookupConversationWithoutServiceId } from '../../util/lookupConversationWithoutServiceId';
import { isDone as isRegistrationDone } from '../../util/registration';
import { getCountryDataForLocale } from '../../util/getCountryData';
import { getUsernameFromSearch } from '../../util/Username';
import { LeftPaneMode } from '../../types/leftPane';

import { ComposerStep, OneTimeModalState } from '../ducks/conversationsEnums';
import {
  getIsSearching,
  getQuery,
  getSearchConversation,
  getSearchResults,
  getStartSearchCounter,
  isSearching,
} from '../selectors/search';
import {
  getIntl,
  getRegionCode,
  getTheme,
  getIsMacOS,
} from '../selectors/user';
import { hasExpired } from '../selectors/expiration';
import {
  isUpdateDialogVisible,
  isUpdateDownloaded,
  isOSUnsupported,
} from '../selectors/updates';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { hasNetworkDialog } from '../selectors/network';
import {
  getPreferredLeftPaneWidth,
  getUsernameCorrupted,
  getUsernameLinkCorrupted,
  getNavTabsCollapsed,
} from '../selectors/items';
import {
  getComposeAvatarData,
  getComposeGroupAvatar,
  getComposeGroupExpireTimer,
  getComposeGroupName,
  getComposerConversationSearchTerm,
  getComposerSelectedRegion,
  getComposerStep,
  getComposerUUIDFetchState,
  getComposeSelectedContacts,
  getFilteredCandidateContactsForNewGroup,
  getFilteredComposeContacts,
  getFilteredComposeGroups,
  getLeftPaneLists,
  getMaximumGroupSizeModalState,
  getMe,
  getRecommendedGroupSizeModalState,
  getSelectedConversationId,
  getTargetedMessage,
  getShowArchived,
  hasGroupCreationError,
  isCreatingGroup,
  isEditingAvatar,
} from '../selectors/conversations';
import type { WidthBreakpoint } from '../../components/_util';
import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../groups/limits';

import { SmartMessageSearchResult } from './MessageSearchResult';
import { SmartNetworkStatus } from './NetworkStatus';
import { SmartRelinkDialog } from './RelinkDialog';
import { SmartUnsupportedOSDialog } from './UnsupportedOSDialog';
import { SmartToastManager } from './ToastManager';
import type { PropsType as SmartUnsupportedOSDialogPropsType } from './UnsupportedOSDialog';
import { SmartUpdateDialog } from './UpdateDialog';
import { SmartCaptchaDialog } from './CaptchaDialog';
import { SmartCrashReportDialog } from './CrashReportDialog';

function renderMessageSearchResult(id: string): JSX.Element {
  return <SmartMessageSearchResult id={id} />;
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
function renderUnsupportedOSDialog(
  props: Readonly<SmartUnsupportedOSDialogPropsType>
): JSX.Element {
  return <SmartUnsupportedOSDialog {...props} />;
}
function renderToastManager(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): JSX.Element {
  return <SmartToastManager {...props} />;
}

function renderToastManagerWithoutMegaphone(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): JSX.Element {
  return <SmartToastManager disableMegaphone {...props} />;
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
          searchConversation,
          searchTerm,
          startSearchCounter: getStartSearchCounter(state),
          ...(searchConversation && searchTerm ? getSearchResults(state) : {}),
        };
      }
      if (isSearching(state)) {
        const primarySendsSms = Boolean(
          get(state.items, ['primarySendsSms'], false)
        );

        return {
          mode: LeftPaneMode.Search,
          primarySendsSms,
          searchConversation: getSearchConversation(state),
          searchDisabled: state.network.challengeStatus !== 'idle',
          startSearchCounter: getStartSearchCounter(state),
          ...getSearchResults(state),
        };
      }
      return {
        mode: LeftPaneMode.Inbox,
        isAboutToSearch: getIsSearching(state),
        searchConversation: getSearchConversation(state),
        searchDisabled: state.network.challengeStatus !== 'idle',
        searchTerm: getQuery(state),
        startSearchCounter: getStartSearchCounter(state),
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

const mapStateToProps = (state: StateType) => {
  const hasUpdateDialog = isUpdateDialogVisible(state);
  const hasUnsupportedOS = isOSUnsupported(state);
  const usernameCorrupted = getUsernameCorrupted(state);
  const usernameLinkCorrupted = getUsernameLinkCorrupted(state);

  let hasExpiredDialog = false;
  let unsupportedOSDialogType: 'error' | 'warning' | undefined;
  if (hasExpired(state)) {
    if (hasUnsupportedOS) {
      unsupportedOSDialogType = 'error';
    } else {
      hasExpiredDialog = true;
    }
  } else if (hasUnsupportedOS) {
    unsupportedOSDialogType = 'warning';
  }

  const composerStep = getComposerStep(state);
  const showArchived = getShowArchived(state);
  const hasSearchQuery = isSearching(state);

  return {
    hasNetworkDialog: hasNetworkDialog(state),
    hasExpiredDialog,
    hasRelinkDialog: !isRegistrationDone(),
    hasUpdateDialog,
    isUpdateDownloaded: isUpdateDownloaded(state),
    unsupportedOSDialogType,
    usernameCorrupted,
    usernameLinkCorrupted,

    modeSpecificProps: getModeSpecificProps(state),
    navTabsCollapsed: getNavTabsCollapsed(state),
    preferredWidthFromStorage: getPreferredLeftPaneWidth(state),
    selectedConversationId: getSelectedConversationId(state),
    targetedMessageId: getTargetedMessage(state)?.id,
    showArchived,
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    isMacOS: getIsMacOS(state),
    regionCode: getRegionCode(state),
    challengeStatus: state.network.challengeStatus,
    crashReportCount: state.crashReports.count,
    renderMessageSearchResult,
    renderNetworkStatus,
    renderRelinkDialog,
    renderUpdateDialog,
    renderCaptchaDialog,
    renderCrashReportDialog,
    renderExpiredBuildDialog,
    renderUnsupportedOSDialog,
    renderToastManager:
      composerStep == null && !showArchived && !hasSearchQuery
        ? renderToastManager
        : renderToastManagerWithoutMegaphone,
    lookupConversationWithoutServiceId,
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
