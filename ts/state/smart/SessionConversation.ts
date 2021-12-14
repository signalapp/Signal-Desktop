import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';
import { getTheme } from '../selectors/theme';
import {
  getLightBoxOptions,
  getSelectedConversation,
  getSelectedConversationKey,
  getSelectedMessageIds,
  getSortedMessagesOfSelectedConversation,
  isMessageDetailView,
  isRightPanelShowing,
} from '../selectors/conversations';
import { getOurNumber } from '../selectors/user';
import { getStagedAttachmentsForCurrentConversation } from '../selectors/stagedAttachments';
import { getHasOngoingCallWithFocusedConvo } from '../selectors/call';
import { SessionConversation } from '../../components/conversation/SessionConversation';

const mapStateToProps = (state: StateType) => {
  return {
    selectedConversation: getSelectedConversation(state),
    selectedConversationKey: getSelectedConversationKey(state),
    theme: getTheme(state),
    messagesProps: getSortedMessagesOfSelectedConversation(state),
    ourNumber: getOurNumber(state),
    showMessageDetails: isMessageDetailView(state),
    isRightPanelShowing: isRightPanelShowing(state),
    selectedMessages: getSelectedMessageIds(state),
    lightBoxOptions: getLightBoxOptions(state),
    stagedAttachments: getStagedAttachmentsForCurrentConversation(state),
    hasOngoingCallWithFocusedConvo: getHasOngoingCallWithFocusedConvo(state),
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
