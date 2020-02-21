import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SessionConversation } from '../../components/session/SessionConversation';
import { StateType } from '../reducer';

import { getSessionConversationInfo } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  const conversationInfo = getSessionConversationInfo(state);

  return {
    ...conversationInfo,
  }
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartSessionConversation = smart(SessionConversation);
