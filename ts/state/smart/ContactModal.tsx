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
  readonly removeMember: (conversationId: string) => void;
  readonly showSafetyNumber: (conversationId: string) => void;
  readonly toggleAdmin: (conversationId: string) => void;
  readonly updateSharedGroups: () => void;
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

  const areWeAdmin =
    currentConversation && currentConversation.areWeAdmin
      ? currentConversation.areWeAdmin
      : false;

  let isMember = false;
  let isAdmin = false;
  if (contact && currentConversation && currentConversation.memberships) {
    currentConversation.memberships.forEach(membership => {
      if (membership.conversationId === contact.id) {
        isMember = true;
        isAdmin = membership.isAdmin;
      }
    });
  }

  return {
    ...props,
    areWeAdmin,
    contact,
    i18n: getIntl(state),
    isAdmin,
    isMember,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartContactModal = smart(ContactModal);
