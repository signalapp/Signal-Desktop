// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import type { PropsDataType } from '../../components/conversation/ContactModal';
import { ContactModal } from '../../components/conversation/ContactModal';
import type { StateType } from '../reducer';

import { getAreWeASubscriber } from '../selectors/items';
import { getIntl, getTheme } from '../selectors/user';
import { getBadgesSelector } from '../selectors/badges';
import { getConversationSelector } from '../selectors/conversations';
import { getHasStoriesSelector } from '../selectors/stories2';

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
      if (membership.aci === contact.serviceId) {
        isMember = true;
        isAdmin = membership.isAdmin;
      }
    });
  }

  const hasStories = getHasStoriesSelector(state)(contactId);

  return {
    areWeASubscriber: getAreWeASubscriber(state),
    areWeAdmin,
    badges: getBadgesSelector(state)(contact.badges),
    contact,
    conversation: currentConversation,
    hasStories,
    i18n: getIntl(state),
    isAdmin,
    isMember,
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartContactModal = smart(ContactModal);
