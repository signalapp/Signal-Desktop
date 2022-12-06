// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { ConversationNotificationsSettings } from '../../components/conversation/conversation-details/ConversationNotificationsSettings';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getConversationByIdSelector } from '../selectors/conversations';
import { strictAssert } from '../../util/assert';
import { mapDispatchToProps } from '../actions';

export type OwnProps = {
  conversationId: string;
};

const mapStateToProps = (state: StateType, props: OwnProps) => {
  const { conversationId } = props;

  const conversationSelector = getConversationByIdSelector(state);
  const conversation = conversationSelector(conversationId);
  strictAssert(conversation, 'Expected a conversation to be found');

  return {
    id: conversationId,
    conversationType: conversation.type,
    dontNotifyForMentionsIfMuted: Boolean(
      conversation.dontNotifyForMentionsIfMuted
    ),
    i18n: getIntl(state),
    muteExpiresAt: conversation.muteExpiresAt,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartConversationNotificationsSettings = smart(
  ConversationNotificationsSettings
);
