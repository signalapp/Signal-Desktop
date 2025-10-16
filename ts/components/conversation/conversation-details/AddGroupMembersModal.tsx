// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useReducer } from 'react';
import lodash from 'lodash';

import type { LocalizerType } from '../../../types/Util.std.js';
import {
  AddGroupMemberErrorDialog,
  AddGroupMemberErrorDialogMode,
} from '../../AddGroupMemberErrorDialog.dom.js';
import type { SmartChooseGroupMembersModalPropsType } from '../../../state/smart/ChooseGroupMembersModal.preload.js';
import type { SmartConfirmAdditionsModalPropsType } from '../../../state/smart/ConfirmAdditionsModal.dom.js';
import {
  toggleSelectedContactForGroupAddition,
  OneTimeModalState,
} from '../../../groups/toggleSelectedContactForGroupAddition.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import type { RequestState } from './util.std.js';

const { without } = lodash;

type PropsType = {
  clearRequestError: () => void;
  conversationIdsAlreadyInGroup: Set<string>;
  groupTitle: string;
  i18n: LocalizerType;
  makeRequest: (conversationIds: ReadonlyArray<string>) => Promise<void>;
  onClose: () => void;
  requestState: RequestState;
  maxGroupSize: number;
  maxRecommendedGroupSize: number;

  renderChooseGroupMembersModal: (
    props: SmartChooseGroupMembersModalPropsType
  ) => JSX.Element;
  renderConfirmAdditionsModal: (
    props: SmartConfirmAdditionsModalPropsType
  ) => JSX.Element;
};

enum Stage {
  ChoosingContacts,
  ConfirmingAdds,
}

type StateType = {
  maxGroupSize: number;
  maxRecommendedGroupSize: number;
  maximumGroupSizeModalState: OneTimeModalState;
  recommendedGroupSizeModalState: OneTimeModalState;
  searchTerm: string;
  selectedConversationIds: ReadonlyArray<string>;
  stage: Stage;
};

enum ActionType {
  CloseMaximumGroupSizeModal,
  CloseRecommendedMaximumGroupSizeModal,
  ConfirmAdds,
  RemoveSelectedContact,
  ReturnToContactChooser,
  ToggleSelectedContact,
  UpdateSearchTerm,
}

type Action =
  | { type: ActionType.CloseMaximumGroupSizeModal }
  | { type: ActionType.CloseRecommendedMaximumGroupSizeModal }
  | { type: ActionType.ConfirmAdds }
  | { type: ActionType.ReturnToContactChooser }
  | { type: ActionType.RemoveSelectedContact; conversationId: string }
  | {
      type: ActionType.ToggleSelectedContact;
      conversationId: string;
      numberOfContactsAlreadyInGroup: number;
    }
  | { type: ActionType.UpdateSearchTerm; searchTerm: string };

// `<ConversationDetails>` isn't currently hooked up to Redux, but that's not desirable in
//   the long term (see DESKTOP-1260). For now, this component has internal state with a
//   reducer. Hopefully, this will make things easier to port to Redux in the future.
function reducer(
  state: Readonly<StateType>,
  action: Readonly<Action>
): StateType {
  switch (action.type) {
    case ActionType.CloseMaximumGroupSizeModal:
      return {
        ...state,
        maximumGroupSizeModalState: OneTimeModalState.Shown,
      };
    case ActionType.CloseRecommendedMaximumGroupSizeModal:
      return {
        ...state,
        recommendedGroupSizeModalState: OneTimeModalState.Shown,
      };
    case ActionType.ConfirmAdds:
      return {
        ...state,
        stage: Stage.ConfirmingAdds,
      };
    case ActionType.ReturnToContactChooser:
      return {
        ...state,
        stage: Stage.ChoosingContacts,
      };
    case ActionType.RemoveSelectedContact:
      return {
        ...state,
        selectedConversationIds: without(
          state.selectedConversationIds,
          action.conversationId
        ),
      };
    case ActionType.ToggleSelectedContact:
      return {
        ...state,
        ...toggleSelectedContactForGroupAddition(action.conversationId, {
          maxGroupSize: state.maxGroupSize,
          maxRecommendedGroupSize: state.maxRecommendedGroupSize,
          maximumGroupSizeModalState: state.maximumGroupSizeModalState,
          numberOfContactsAlreadyInGroup: action.numberOfContactsAlreadyInGroup,
          recommendedGroupSizeModalState: state.recommendedGroupSizeModalState,
          selectedConversationIds: state.selectedConversationIds,
        }),
      };
    case ActionType.UpdateSearchTerm:
      return {
        ...state,
        searchTerm: action.searchTerm,
      };
    default:
      throw missingCaseError(action);
  }
}

export function AddGroupMembersModal({
  clearRequestError,
  conversationIdsAlreadyInGroup,
  groupTitle,
  i18n,
  onClose,
  makeRequest,
  maxGroupSize,
  maxRecommendedGroupSize,
  requestState,
  renderChooseGroupMembersModal,
  renderConfirmAdditionsModal,
}: PropsType): JSX.Element {
  const numberOfContactsAlreadyInGroup = conversationIdsAlreadyInGroup.size;
  const isGroupAlreadyFull = numberOfContactsAlreadyInGroup >= maxGroupSize;
  const isGroupAlreadyOverRecommendedMaximum =
    numberOfContactsAlreadyInGroup >= maxRecommendedGroupSize;

  const [
    {
      maximumGroupSizeModalState,
      recommendedGroupSizeModalState,
      searchTerm,
      selectedConversationIds,
      stage,
    },
    dispatch,
  ] = useReducer(reducer, {
    maxGroupSize,
    maxRecommendedGroupSize,
    maximumGroupSizeModalState: isGroupAlreadyFull
      ? OneTimeModalState.Showing
      : OneTimeModalState.NeverShown,
    recommendedGroupSizeModalState: isGroupAlreadyOverRecommendedMaximum
      ? OneTimeModalState.Shown
      : OneTimeModalState.NeverShown,
    searchTerm: '',
    selectedConversationIds: [],
    stage: Stage.ChoosingContacts,
  });

  if (maximumGroupSizeModalState === OneTimeModalState.Showing) {
    return (
      <AddGroupMemberErrorDialog
        i18n={i18n}
        maximumNumberOfContacts={maxGroupSize}
        mode={AddGroupMemberErrorDialogMode.MaximumGroupSize}
        onClose={() => {
          dispatch({ type: ActionType.CloseMaximumGroupSizeModal });
        }}
      />
    );
  }

  if (recommendedGroupSizeModalState === OneTimeModalState.Showing) {
    return (
      <AddGroupMemberErrorDialog
        i18n={i18n}
        mode={AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize}
        onClose={() => {
          dispatch({
            type: ActionType.CloseRecommendedMaximumGroupSizeModal,
          });
        }}
        recommendedMaximumNumberOfContacts={maxRecommendedGroupSize}
      />
    );
  }

  switch (stage) {
    case Stage.ChoosingContacts: {
      // See note above: these will soon become Redux actions.
      const confirmAdds = () => {
        dispatch({ type: ActionType.ConfirmAdds });
      };
      const removeSelectedContact = (conversationId: string) => {
        dispatch({
          type: ActionType.RemoveSelectedContact,
          conversationId,
        });
      };
      const setSearchTerm = (term: string) => {
        dispatch({
          type: ActionType.UpdateSearchTerm,
          searchTerm: term,
        });
      };
      const toggleSelectedContact = (conversationId: string) => {
        dispatch({
          type: ActionType.ToggleSelectedContact,
          conversationId,
          numberOfContactsAlreadyInGroup,
        });
      };

      return renderChooseGroupMembersModal({
        confirmAdds,
        selectedConversationIds,
        conversationIdsAlreadyInGroup,
        maxGroupSize,
        onClose,
        removeSelectedContact,
        searchTerm,
        setSearchTerm,
        toggleSelectedContact,
      });
    }
    case Stage.ConfirmingAdds: {
      const onCloseConfirmationDialog = () => {
        dispatch({ type: ActionType.ReturnToContactChooser });
        clearRequestError();
      };

      return renderConfirmAdditionsModal({
        groupTitle,
        makeRequest: () => {
          void makeRequest(selectedConversationIds);
        },
        onClose: onCloseConfirmationDialog,
        requestState,
        selectedConversationIds,
      });
    }
    default:
      throw missingCaseError(stage);
  }
}
