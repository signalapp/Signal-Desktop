// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent, useMemo, useReducer } from 'react';
import { without } from 'lodash';

import { LocalizerType } from '../../../types/Util';
import {
  AddGroupMemberErrorDialog,
  AddGroupMemberErrorDialogMode,
} from '../../AddGroupMemberErrorDialog';
import { ConversationType } from '../../../state/ducks/conversations';
import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../../groups/limits';
import {
  toggleSelectedContactForGroupAddition,
  OneTimeModalState,
} from '../../../groups/toggleSelectedContactForGroupAddition';
import { makeLookup } from '../../../util/makeLookup';
import { deconstructLookup } from '../../../util/deconstructLookup';
import { missingCaseError } from '../../../util/missingCaseError';
import { RequestState } from './util';
import { ChooseGroupMembersModal } from './AddGroupMembersModal/ChooseGroupMembersModal';
import { ConfirmAdditionsModal } from './AddGroupMembersModal/ConfirmAdditionsModal';

type PropsType = {
  candidateContacts: ReadonlyArray<ConversationType>;
  clearRequestError: () => void;
  conversationIdsAlreadyInGroup: Set<string>;
  groupTitle: string;
  i18n: LocalizerType;
  makeRequest: (conversationIds: ReadonlyArray<string>) => Promise<void>;
  onClose: () => void;
  requestState: RequestState;
};

enum Stage {
  ChoosingContacts,
  ConfirmingAdds,
}

type StateType = {
  cantAddContactForModal: undefined | ConversationType;
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
  SetCantAddContactForModal,
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
      type: ActionType.SetCantAddContactForModal;
      contact: undefined | ConversationType;
    }
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
    case ActionType.SetCantAddContactForModal:
      return {
        ...state,
        cantAddContactForModal: action.contact,
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
  candidateContacts,
  clearRequestError,
  conversationIdsAlreadyInGroup,
  groupTitle,
  i18n,
  onClose,
  makeRequest,
  requestState,
}) => {
  const maxGroupSize = getMaximumNumberOfContacts();
  const maxRecommendedGroupSize = getRecommendedMaximumNumberOfContacts();

  const numberOfContactsAlreadyInGroup = conversationIdsAlreadyInGroup.size;
  const isGroupAlreadyFull = numberOfContactsAlreadyInGroup >= maxGroupSize;
  const isGroupAlreadyOverRecommendedMaximum =
    numberOfContactsAlreadyInGroup >= maxRecommendedGroupSize;

  const [
    {
      cantAddContactForModal,
      maximumGroupSizeModalState,
      recommendedGroupSizeModalState,
      searchTerm,
      selectedConversationIds,
      stage,
    },
    dispatch,
  ] = useReducer(reducer, {
    cantAddContactForModal: undefined,
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

  const contactLookup = useMemo(() => makeLookup(candidateContacts, 'id'), [
    candidateContacts,
  ]);

  const selectedContacts = deconstructLookup(
    contactLookup,
    selectedConversationIds
  );

  if (cantAddContactForModal) {
    return (
      <AddGroupMemberErrorDialog
        contact={cantAddContactForModal}
        i18n={i18n}
        mode={AddGroupMemberErrorDialogMode.CantAddContact}
        onClose={() => {
          dispatch({
            type: ActionType.SetCantAddContactForModal,
            contact: undefined,
          });
        }}
      />
    );
  }

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
      const setCantAddContactForModal = (
        contact: undefined | Readonly<ConversationType>
      ) => {
        dispatch({
          type: ActionType.SetCantAddContactForModal,
          contact,
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

      return (
        <ChooseGroupMembersModal
          candidateContacts={candidateContacts}
          confirmAdds={confirmAdds}
          contactLookup={contactLookup}
          conversationIdsAlreadyInGroup={conversationIdsAlreadyInGroup}
          i18n={i18n}
          maxGroupSize={maxGroupSize}
          onClose={onClose}
          removeSelectedContact={removeSelectedContact}
          searchTerm={searchTerm}
          selectedContacts={selectedContacts}
          setCantAddContactForModal={setCantAddContactForModal}
          setSearchTerm={setSearchTerm}
          toggleSelectedContact={toggleSelectedContact}
        />
      );
    }
    case Stage.ConfirmingAdds: {
      const onCloseConfirmationDialog = () => {
        dispatch({ type: ActionType.ReturnToContactChooser });
        clearRequestError();
      };

      return (
        <ConfirmAdditionsModal
          groupTitle={groupTitle}
          i18n={i18n}
          makeRequest={() => {
            makeRequest(selectedConversationIds);
          }}
          onClose={onCloseConfirmationDialog}
          requestState={requestState}
          selectedContacts={selectedContacts}
        />
      );
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
