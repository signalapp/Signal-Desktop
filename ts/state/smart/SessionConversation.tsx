import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SessionConversation } from '../../components/session/SessionConversation';
import { StateType } from '../reducer';

import { getSessionConversationInfo } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  //const conversationInfo = getSessionConversationInfo(state);

  // console.log(`[vince] stateToProps from SessionConversation:`, conversationInfo);
  console.log(`[vince] stateToProps from SessionConversation:`,state);

  return {
    ...state,
  }
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartSessionConversation = smart(SessionConversation);
