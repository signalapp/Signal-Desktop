// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties } from 'react';
import { connect } from 'react-redux';
import { get } from 'lodash';
import { mapDispatchToProps } from '../actions';
import {
  LeftPane,
  LeftPaneMode,
  PropsType as LeftPanePropsType,
} from '../../components/LeftPane';
import { StateType } from '../reducer';
import { missingCaseError } from '../../util/missingCaseError';

import { ComposerStep, OneTimeModalState } from '../ducks/conversations';
import { getSearchResults, isSearching } from '../selectors/search';
import { getIntl, getRegionCode } from '../selectors/user';
import {
  getFilteredCandidateContactsForNewGroup,
  getCantAddContactForModal,
  getFilteredComposeContacts,
  getFilteredComposeGroups,
  getComposeGroupAvatar,
  getComposeGroupName,
  getComposeSelectedContacts,
  getComposerConversationSearchTerm,
  getComposerStep,
  getLeftPaneLists,
  getMaximumGroupSizeModalState,
  getRecommendedGroupSizeModalState,
  getSelectedConversationId,
  getSelectedMessage,
  getShowArchived,
  hasGroupCreationError,
  isCreatingGroup,
} from '../selectors/conversations';

import { SmartExpiredBuildDialog } from './ExpiredBuildDialog';
import { SmartMainHeader } from './MainHeader';
import { SmartMessageSearchResult } from './MessageSearchResult';
import { SmartNetworkStatus } from './NetworkStatus';
import { SmartRelinkDialog } from './RelinkDialog';
import { SmartUpdateDialog } from './UpdateDialog';
import { SmartCaptchaDialog } from './CaptchaDialog';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredSmartMessageSearchResult = SmartMessageSearchResult as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function renderExpiredBuildDialog(): JSX.Element {
  return <SmartExpiredBuildDialog />;
}
function renderMainHeader(): JSX.Element {
  return <SmartMainHeader />;
}
function renderMessageSearchResult(
  id: string,
  style: CSSProperties
): JSX.Element {
  return <FilteredSmartMessageSearchResult id={id} style={style} />;
}
function renderNetworkStatus(): JSX.Element {
  return <SmartNetworkStatus />;
}
function renderRelinkDialog(): JSX.Element {
  return <SmartRelinkDialog />;
}
function renderUpdateDialog(): JSX.Element {
  return <SmartUpdateDialog />;
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
        return {
          mode: LeftPaneMode.Archive,
          archivedConversations,
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
        ...getLeftPaneLists(state),
      };
    case ComposerStep.StartDirectConversation:
      return {
        mode: LeftPaneMode.Compose,
        composeContacts: getFilteredComposeContacts(state),
        composeGroups: getFilteredComposeGroups(state),
        regionCode: getRegionCode(state),
        searchTerm: getComposerConversationSearchTerm(state),
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
        hasError: hasGroupCreationError(state),
        isCreating: isCreatingGroup(state),
        selectedContacts: getComposeSelectedContacts(state),
      };
    default:
      throw missingCaseError(composerStep);
  }
};

const mapStateToProps = (state: StateType) => {
  return {
    modeSpecificProps: getModeSpecificProps(state),
    selectedConversationId: getSelectedConversationId(state),
    selectedMessageId: getSelectedMessage(state)?.id,
    showArchived: getShowArchived(state),
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
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
