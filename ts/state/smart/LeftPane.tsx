// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { get } from 'lodash';
import { mapDispatchToProps } from '../actions';
import type { PropsType as LeftPanePropsType } from '../../components/LeftPane';
import { LeftPane, LeftPaneMode } from '../../components/LeftPane';
import type { StateType } from '../reducer';
import { missingCaseError } from '../../util/missingCaseError';
import { isAlpha, isBeta } from '../../util/version';

import { ComposerStep, OneTimeModalState } from '../ducks/conversationsEnums';
import {
  getIsSearchingInAConversation,
  getQuery,
  getSearchConversation,
  getSearchResults,
  getStartSearchCounter,
  isSearching,
} from '../selectors/search';
import { getIntl, getRegionCode, getTheme } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getPreferredLeftPaneWidth,
  getUsernamesEnabled,
} from '../selectors/items';
import {
  getCantAddContactForModal,
  getComposeAvatarData,
  getComposeGroupAvatar,
  getComposeGroupExpireTimer,
  getComposeGroupName,
  getComposerConversationSearchTerm,
  getComposerStep,
  getComposeSelectedContacts,
  getFilteredCandidateContactsForNewGroup,
  getFilteredComposeContacts,
  getFilteredComposeGroups,
  getIsFetchingUsername,
  getLeftPaneLists,
  getMaximumGroupSizeModalState,
  getRecommendedGroupSizeModalState,
  getSelectedConversationId,
  getSelectedMessage,
  getShowArchived,
  hasGroupCreationError,
  isCreatingGroup,
  isEditingAvatar,
} from '../selectors/conversations';
import type { WidthBreakpoint } from '../../components/_util';

import { SmartExpiredBuildDialog } from './ExpiredBuildDialog';
import { SmartMainHeader } from './MainHeader';
import { SmartMessageSearchResult } from './MessageSearchResult';
import { SmartNetworkStatus } from './NetworkStatus';
import { SmartRelinkDialog } from './RelinkDialog';
import { SmartUpdateDialog } from './UpdateDialog';
import { SmartCaptchaDialog } from './CaptchaDialog';

function renderExpiredBuildDialog(
  props: Readonly<{ containerWidthBreakpoint: WidthBreakpoint }>
): JSX.Element {
  return <SmartExpiredBuildDialog {...props} />;
}
function renderMainHeader(): JSX.Element {
  return <SmartMainHeader />;
}
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

const getModeSpecificProps = (
  state: StateType
): LeftPanePropsType['modeSpecificProps'] => {
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
          ...getSearchResults(state),
        };
      }
      return {
        mode: LeftPaneMode.Inbox,
        isAboutToSearchInAConversation: getIsSearchingInAConversation(state),
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
        isUsernamesEnabled: getUsernamesEnabled(state),
        isFetchingUsername: getIsFetchingUsername(state),
      };
    case ComposerStep.ChooseGroupMembers:
      return {
        mode: LeftPaneMode.ChooseGroupMembers,
        candidateContacts: getFilteredCandidateContactsForNewGroup(state),
        cantAddContactForModal: getCantAddContactForModal(state),
        isShowingRecommendedGroupSizeModal:
          getRecommendedGroupSizeModalState(state) ===
          OneTimeModalState.Showing,
        isShowingMaximumGroupSizeModal:
          getMaximumGroupSizeModalState(state) === OneTimeModalState.Showing,
        searchTerm: getComposerConversationSearchTerm(state),
        selectedContacts: getComposeSelectedContacts(state),
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

const canResizeLeftPane = () =>
  window.Signal.RemoteConfig.isEnabled('desktop.internalUser') ||
  isAlpha(window.getVersion()) ||
  isBeta(window.getVersion())
    ? window.Signal.RemoteConfig.isEnabled('desktop.canResizeLeftPane.beta')
    : window.Signal.RemoteConfig.isEnabled(
        'desktop.canResizeLeftPane.production'
      );

const mapStateToProps = (state: StateType) => {
  return {
    modeSpecificProps: getModeSpecificProps(state),
    canResizeLeftPane: canResizeLeftPane(),
    preferredWidthFromStorage: getPreferredLeftPaneWidth(state),
    selectedConversationId: getSelectedConversationId(state),
    selectedMessageId: getSelectedMessage(state)?.id,
    showArchived: getShowArchived(state),
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    regionCode: getRegionCode(state),
    challengeStatus: state.network.challengeStatus,
    renderExpiredBuildDialog,
    renderMainHeader,
    renderMessageSearchResult,
    renderNetworkStatus,
    renderRelinkDialog,
    renderUpdateDialog,
    renderCaptchaDialog,
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
