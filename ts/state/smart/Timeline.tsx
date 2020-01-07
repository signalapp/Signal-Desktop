import { pick } from 'lodash';
import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { Timeline } from '../../components/conversation/Timeline';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import {
  getConversationMessagesSelector,
  getConversationSelector,
  getSelectedMessage,
} from '../selectors/conversations';

import { SmartTimelineItem } from './TimelineItem';
import { SmartTypingBubble } from './TypingBubble';
import { SmartLastSeenIndicator } from './LastSeenIndicator';
import { SmartTimelineLoadingRow } from './TimelineLoadingRow';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredSmartTimelineItem = SmartTimelineItem as any;
const FilteredSmartTypingBubble = SmartTypingBubble as any;
const FilteredSmartLastSeenIndicator = SmartLastSeenIndicator as any;
const FilteredSmartTimelineLoadingRow = SmartTimelineLoadingRow as any;

type ExternalProps = {
  id: string;

  // Note: most action creators are not wired into redux; for now they
  //   are provided by ConversationView in setupTimeline().
};

function renderItem(
  messageId: string,
  conversationId: string,
  actionProps: Object
): JSX.Element {
  return (
    <FilteredSmartTimelineItem
      {...actionProps}
      conversationId={conversationId}
      id={messageId}
    />
  );
}
function renderLastSeenIndicator(id: string): JSX.Element {
  return <FilteredSmartLastSeenIndicator id={id} />;
}
function renderLoadingRow(id: string): JSX.Element {
  return <FilteredSmartTimelineLoadingRow id={id} />;
}
function renderTypingBubble(id: string): JSX.Element {
  return <FilteredSmartTypingBubble id={id} />;
}

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id, ...actions } = props;

  const conversation = getConversationSelector(state)(id);
  const conversationMessages = getConversationMessagesSelector(state)(id);
  const selectedMessage = getSelectedMessage(state);

  return {
    id,
    ...pick(conversation, ['unreadCount', 'typingContact']),
    ...conversationMessages,
    selectedMessageId: selectedMessage ? selectedMessage.id : undefined,
    i18n: getIntl(state),
    renderItem,
    renderLastSeenIndicator,
    renderLoadingRow,
    renderTypingBubble,
    ...actions,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimeline = smart(Timeline);
