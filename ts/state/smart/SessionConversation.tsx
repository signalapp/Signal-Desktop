import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SessionConversation } from '../../components/session/conversation/SessionConversation';
import { StateType } from '../reducer';
import { getPrimaryPubkey } from '../selectors/user';
import { getTheme } from '../selectors/theme';
import {
  getMessagesOfSelectedConversation,
  getSelectedConversation,
  getSelectedConversationKey,
} from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  return {
    selectedConversation: getSelectedConversation(state),
    selectedConversationKey: getSelectedConversationKey(state),
    theme: getTheme(state),
    messages: getMessagesOfSelectedConversation(state),
    ourPrimary: getPrimaryPubkey(state),
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
