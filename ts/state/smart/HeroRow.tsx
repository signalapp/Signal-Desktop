import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { ConversationHero } from '../../components/conversation/ConversationHero';

import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';

type ExternalProps = {
  id: string;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversation = state.conversations.conversationLookup[id];

  if (!conversation) {
    throw new Error(`Did not find conversation ${id} in state!`);
  }

  return {
    i18n: getIntl(state),
    ...conversation,
    conversationType: conversation.type,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartHeroRow = smart(ConversationHero);
