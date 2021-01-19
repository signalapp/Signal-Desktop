import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SessionConversation } from '../../components/session/conversation/SessionConversation';
import { StateType } from '../reducer';
import { getPrimaryPubkey } from '../selectors/user';

const mapStateToProps = (state: StateType) => {
  const conversationKey = state.conversations.selectedConversation;
  const ourPrimary = getPrimaryPubkey(state);
  const conversation =
    (conversationKey &&
      state.conversations.conversationLookup[conversationKey]) ||
    null;
  return {
    conversation,
    conversationKey,
    theme: state.theme,
    messages: state.conversations.messages,
    ourPrimary,
  };
};

const smart = connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => {
    return {
      ...stateProps,
      router: ownProps,
      actions: dispatchProps,
    };
  }
);
export const SmartSessionConversation = smart(SessionConversation);
