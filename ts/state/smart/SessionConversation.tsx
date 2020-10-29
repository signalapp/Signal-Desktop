import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SessionConversation } from '../../components/session/conversation/SessionConversation';
import { StateType } from '../reducer';

const mapStateToProps = (state: StateType) => {
  // Get messages here!!!!!

  // FIXME VINCE: Get messages for all conversations, not just this one
  // Store as object of objects with key refs

  // console.log(`[update] State from dispatch:`, state);

  // const message: Array<any> = [];
  // if(state.conversations) {
  //   const conversationKey = state.conversations.selectedConversation;

  //   // FIXME VINCE: msgCount should not be a magic number
  //   const msgCount = 30;

  //   const messageSet = await window.Signal.Data.getMessagesByConversation(
  //     conversationKey,
  //     { limit: msgCount, MessageCollection: window.Whisper.MessageCollection },
  //   );

  //   const messageModels = messageSet.models;
  //   let previousSender;
  //   for (let i = 0; i < messageModels.length; i++){
  //     // Handle firstMessageOfSeries for conditional avatar rendering
  //     let firstMessageOfSeries = true;
  //     if (i > 0 && previousSender === messageModels[i].authorPhoneNumber){
  //       firstMessageOfSeries = false;
  //     }

  //     messages.push({...messageModels[i], firstMessageOfSeries});
  //     previousSender = messageModels[i].authorPhoneNumber;
  //   }
  // }

  const conversationKey = state.conversations.selectedConversation;
  const conversation =
    (conversationKey &&
      state.conversations.conversationLookup[conversationKey]) ||
    null;

  return {
    conversation,
    conversationKey,
    theme: state.theme,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartSessionConversation = smart(SessionConversation);
