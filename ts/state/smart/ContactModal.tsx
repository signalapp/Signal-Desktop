// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import {
  ContactModal,
  PropsType,
} from '../../components/conversation/ContactModal';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getConversationSelector } from '../selectors/conversations';

export type SmartContactModalProps = {
  contactId: string;
  currentConversationId: string;
  readonly onClose: () => unknown;
  readonly openConversation: (conversationId: string) => void;
  readonly showSafetyNumber: (conversationId: string) => void;
  readonly removeMember: (conversationId: string) => void;
};

const mapStateToProps = (
  state: StateType,
  props: SmartContactModalProps
): PropsType => {
  const { contactId, currentConversationId } = props;

  const currentConversation = getConversationSelector(state)(
    currentConversationId
  );
  const contact = getConversationSelector(state)(contactId);
  const isMember =
    contact && currentConversation && currentConversation.members
      ? currentConversation.members.includes(contact)
      : false;

  const areWeAdmin =
    currentConversation && currentConversation.areWeAdmin
      ? currentConversation.areWeAdmin
      : false;

  return {
    ...props,
    areWeAdmin,
    contact,
    i18n: getIntl(state),
    isMember,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartContactModal = smart(ContactModal);
