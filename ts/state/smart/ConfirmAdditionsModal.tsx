// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import type { StateType } from '../reducer';
import { mapDispatchToProps } from '../actions';
import { strictAssert } from '../../util/assert';

import type { StatePropsType } from '../../components/conversation/conversation-details/AddGroupMembersModal/ConfirmAdditionsModal';
import { ConfirmAdditionsModal } from '../../components/conversation/conversation-details/AddGroupMembersModal/ConfirmAdditionsModal';
import type { RequestState } from '../../components/conversation/conversation-details/util';

import { getIntl } from '../selectors/user';
import { getConversationByIdSelector } from '../selectors/conversations';

export type SmartConfirmAdditionsModalPropsType = {
  selectedConversationIds: ReadonlyArray<string>;
  groupTitle: string;
  makeRequest: () => void;
  onClose: () => void;
  requestState: RequestState;
};

const mapStateToProps = (
  state: StateType,
  props: SmartConfirmAdditionsModalPropsType
): StatePropsType => {
  const conversationSelector = getConversationByIdSelector(state);

  const selectedContacts = props.selectedConversationIds.map(conversationId => {
    const convo = conversationSelector(conversationId);
    strictAssert(
      convo,
      '<SmartChooseGroupMemberModal> selected conversation not found'
    );
    return convo;
  });

  return {
    ...props,
    selectedContacts,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartConfirmAdditionsModal = smart(ConfirmAdditionsModal);
