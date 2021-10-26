// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { TypingBubble } from '../../components/conversation/TypingBubble';
import { strictAssert } from '../../util/assert';
import type { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getConversationSelector } from '../selectors/conversations';

type ExternalProps = {
  id: string;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversation = getConversationSelector(state)(id);
  if (!conversation) {
    throw new Error(`Did not find conversation ${id} in state!`);
  }

  strictAssert(conversation.typingContact, 'Missing typingContact');

  return {
    ...conversation.typingContact,
    conversationType: conversation.type,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTypingBubble = smart(TypingBubble);
