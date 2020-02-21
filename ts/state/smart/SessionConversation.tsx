import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SessionConversation } from '../../components/session/SessionConversation';
import { StateType } from '../reducer';

import { getSessionConversationInfo, getSelectedConversation } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  const lists = getSessionConversationInfo(state);
  const selectedConversation = getSelectedConversation(state);
  
  return {
    ...lists,
    selectedConversation,
  }
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartSessionConversation = smart(SessionConversation);
