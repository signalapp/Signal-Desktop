// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import {
  ContactModal,
  PropsDataType,
} from '../../components/conversation/ContactModal';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getConversationSelector } from '../selectors/conversations';

const mapStateToProps = (state: StateType): PropsDataType => {
  const { contactId, conversationId } =
    state.globalModals.contactModalState || {};

  const currentConversation = getConversationSelector(state)(conversationId);
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
    areWeAdmin,
    contact,
    conversationId,
    i18n: getIntl(state),
    isAdmin,
    isMember,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartContactModal = smart(ContactModal);
