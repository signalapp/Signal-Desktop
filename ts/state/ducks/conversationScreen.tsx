import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MessagePropsDetails } from './conversations';

export type ConversationScreenState = {
  messageDetailProps: MessagePropsDetails | undefined;
  showRightPanel: boolean;
  selectedMessageIds: Array<string>;
};

export const initialConversationScreen: ConversationScreenState = {
  messageDetailProps: undefined,
  showRightPanel: false,
  selectedMessageIds: [],
};

/**
 * This slice is the one holding the layout of the Conversation Screen of the app
 */
const conversationScreenSlice = createSlice({
  name: 'conversationScreen',
  initialState: initialConversationScreen,
  reducers: {
    showMessageDetailsView(
      state: ConversationScreenState,
      action: PayloadAction<MessagePropsDetails>
    ) {
      // force the right panel to be hidden when showing message detail view
      return { ...state, messageDetailProps: action.payload, showRightPanel: false };
    },

    closeMessageDetailsView(state: ConversationScreenState) {
      return { ...state, messageDetailProps: undefined };
    },

    openRightPanel(state: ConversationScreenState) {
      return { ...state, showRightPanel: true };
    },
    closeRightPanel(state: ConversationScreenState) {
      return { ...state, showRightPanel: false };
    },
    addMessageIdToSelection(state: ConversationScreenState, action: PayloadAction<string>) {
      if (state.selectedMessageIds.some(id => id === action.payload)) {
        return state;
      }
      return { ...state, selectedMessageIds: [...state.selectedMessageIds, action.payload] };
    },
    removeMessageIdFromSelection(state: ConversationScreenState, action: PayloadAction<string>) {
      const index = state.selectedMessageIds.findIndex(id => id === action.payload);

      if (index === -1) {
        return state;
      }
      return { ...state, selectedMessageIds: state.selectedMessageIds.splice(index, 1) };
    },
    toggleSelectedMessageId(state: ConversationScreenState, action: PayloadAction<string>) {
      const index = state.selectedMessageIds.findIndex(id => id === action.payload);

      if (index === -1) {
        return { ...state, selectedMessageIds: [...state.selectedMessageIds, action.payload] };
      }
      return { ...state, selectedMessageIds: state.selectedMessageIds.splice(index, 1) };
    },
    resetSelectedMessageIds(state: ConversationScreenState) {
      return { ...state, selectedMessageIds: [] };
    },
  },
});

// destructures
const { actions, reducer } = conversationScreenSlice;
export const {
  showMessageDetailsView,
  closeMessageDetailsView,
  openRightPanel,
  closeRightPanel,
  addMessageIdToSelection,
  resetSelectedMessageIds,
} = actions;
export const defaultConversationScreenReducer = reducer;
