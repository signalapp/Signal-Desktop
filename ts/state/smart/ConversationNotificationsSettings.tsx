// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { ConversationNotificationsSettings } from '../../components/conversation/conversation-details/ConversationNotificationsSettings';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getConversationByIdSelector } from '../selectors/conversations';
import { strictAssert } from '../../util/assert';

export type OwnProps = {
  conversationId: string;
  setDontNotifyForMentionsIfMuted: (
    dontNotifyForMentionsIfMuted: boolean
  ) => unknown;
  setMuteExpiration: (muteExpiresAt: undefined | number) => unknown;
};

const mapStateToProps = (state: StateType, props: OwnProps) => {
  const { conversationId, setDontNotifyForMentionsIfMuted, setMuteExpiration } =
    props;

  const conversationSelector = getConversationByIdSelector(state);
  const conversation = conversationSelector(conversationId);
  strictAssert(conversation, 'Expected a conversation to be found');

  return {
    conversationType: conversation.type,
    dontNotifyForMentionsIfMuted: Boolean(
      conversation.dontNotifyForMentionsIfMuted
    ),
    i18n: getIntl(state),
    muteExpiresAt: conversation.muteExpiresAt,
    setDontNotifyForMentionsIfMuted,
    setMuteExpiration,
  };
};

const smart = connect(mapStateToProps, {});

export const SmartConversationNotificationsSettings = smart(
  ConversationNotificationsSettings
);
