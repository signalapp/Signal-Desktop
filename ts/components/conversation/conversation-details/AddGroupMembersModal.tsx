// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React, { useReducer } from 'react';
import { without } from 'lodash';

import type { LocalizerType } from '../../../types/Util';
import {
  AddGroupMemberErrorDialog,
  AddGroupMemberErrorDialogMode,
} from '../../AddGroupMemberErrorDialog';
import type { SmartChooseGroupMembersModalPropsType } from '../../../state/smart/ChooseGroupMembersModal';
import type { SmartConfirmAdditionsModalPropsType } from '../../../state/smart/ConfirmAdditionsModal';
import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../../groups/limits';
import {
  toggleSelectedContactForGroupAddition,
  OneTimeModalState,
} from '../../../groups/toggleSelectedContactForGroupAddition';
import { missingCaseError } from '../../../util/missingCaseError';
import type { RequestState } from './util';

type PropsType = {
  clearRequestError: () => void;
  conversationIdsAlreadyInGroup: Set<string>;
  groupTitle: string;
  i18n: LocalizerType;
  makeRequest: (conversationIds: ReadonlyArray<string>) => Promise<void>;
  onClose: () => void;
  requestState: RequestState;

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
  maximumGroupSizeModalState: OneTimeModalState;
  recommendedGroupSizeModalState: OneTimeModalState;
  searchTerm: string;
  selectedConversationIds: Array<string>;
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
          maxGroupSize: getMaximumNumberOfContacts(),
          maxRecommendedGroupSize: getRecommendedMaximumNumberOfContacts(),
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

export const AddGroupMembersModal: FunctionComponent<PropsType> = ({
  clearRequestError,
  conversationIdsAlreadyInGroup,
  groupTitle,
  i18n,
  onClose,
  makeRequest,
  requestState,
  renderChooseGroupMembersModal,
  renderConfirmAdditionsModal,
}) => {
  const maxGroupSize = getMaximumNumberOfContacts();
  const maxRecommendedGroupSize = getRecommendedMaximumNumberOfContacts();

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
          makeRequest(selectedConversationIds);
        },
        onClose: onCloseConfirmationDialog,
        requestState,
        selectedConversationIds,
      });
    }
    default:
      throw missingCaseError(stage);
  }
};

function getRecommendedMaximumNumberOfContacts(): number {
  return getGroupSizeRecommendedLimit(151);
}

function getMaximumNumberOfContacts(): number {
  return getGroupSizeHardLimit(1001);
}
