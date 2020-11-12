import { Constants } from '../../session';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import _ from 'lodash';
import { MessageType } from './conversations';

export type MessagesStateType = Array<MessageType>;

export async function getMessages(
  conversationKey: string,
  numMessages: number
) : Promise<MessagesStateType> {
  const conversation = window.ConversationController.get(conversationKey);
  if (!conversation) {
    // no valid conversation, early return
    window.log.error('Failed to get convo on reducer.');
    return [];
  }
  const unreadCount = await conversation.getUnreadCount();
  let msgCount =
    numMessages ||
    Number(Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT) + unreadCount;
  msgCount =
    msgCount > Constants.CONVERSATION.MAX_MESSAGE_FETCH_COUNT
      ? Constants.CONVERSATION.MAX_MESSAGE_FETCH_COUNT
      : msgCount;

  if (msgCount < Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT) {
    msgCount = Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT;
  }

  const messageSet = await window.Signal.Data.getMessagesByConversation(
    conversationKey,
    { limit: msgCount, MessageCollection: window.Whisper.MessageCollection }
  );

  // Set first member of series here.
  const messageModels = messageSet.models;

  const messages = [];
  // no need to do that `firstMessageOfSeries` on a private chat
  if (conversation.isPrivate()) {
    return messageSet.models;
  }

  // messages are got from the more recent to the oldest, so we need to check if
  // the next messages in the list is still the same author.
  // The message is the first of the series if the next message is not from the same authori
  for (let i = 0; i < messageModels.length; i++) {
    // Handle firstMessageOfSeries for conditional avatar rendering
    let firstMessageOfSeries = true;
    const currentSender = messageModels[i].propsForMessage?.authorPhoneNumber;
    const nextSender =
      i < messageModels.length - 1
        ? messageModels[i + 1].propsForMessage?.authorPhoneNumber
        : undefined;
    if (i > 0 && currentSender === nextSender) {
      firstMessageOfSeries = false;
    }
    messages.push({ ...messageModels[i], firstMessageOfSeries });
  }
  return messages;
}

// ACTIONS
const fetchMessagesForConversation = createAsyncThunk(
  'messages/fetchByConversationKey',
  async ({
    conversationKey,
    count,
  }: {
    conversationKey: string;
    count: number;
  }) => {
    return getMessages(conversationKey, count);
  }
);

const toOmitFromMessageModel = [
  'cid',
  'collection',
  // 'changing',
  // 'previousAttributes',
  '_events',
  '_listeningTo',
];

const messageSlice = createSlice({
  name: 'messages',
  initialState: [] as MessagesStateType,
  reducers: {
    messageChanged(state, action){
      console.log('message changed ', state, action)
      const messageInStoreIndex = state.findIndex(m => m.id === action.payload.id);
      if (messageInStoreIndex >= 0) {
        state[messageInStoreIndex] = _.omit(action.payload, toOmitFromMessageModel)
        ;
      }
      return state;
    },
  },
  extraReducers: {
    // Add reducers for additional action types here, and handle loading state as needed
    [fetchMessagesForConversation.fulfilled.type]: (state, action) => {
      const lightMessages = action.payload.map((m: any) =>
        _.omit(m, toOmitFromMessageModel)
      );
      return lightMessages;
    },
  },
});

export const actions = {
  ...messageSlice.actions,
  fetchMessagesForConversation,
};
export const reducer = messageSlice.reducer;
