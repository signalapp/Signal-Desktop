import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { TypingBubble } from '../../components/conversation/TypingBubble';
import { StateType } from '../reducer';

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

  return {
    ...conversation.typingContact,
    conversationType: conversation.type,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTypingBubble = smart(TypingBubble);
