import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import { ConversationScreenState } from '../ducks/conversationScreen';
import { MessagePropsDetails } from '../ducks/conversations';

export const getConversationScreenState = (state: StateType): ConversationScreenState =>
  state.conversationScreen;

export const isMessageDetailView = createSelector(
  getConversationScreenState,
  (state: ConversationScreenState): boolean => state.messageDetailProps !== undefined
);

export const getMessageDetailsViewProps = createSelector(
  getConversationScreenState,
  (state: ConversationScreenState): MessagePropsDetails | undefined => state.messageDetailProps
);

export const isRightPanelShowing = createSelector(
  getConversationScreenState,
  (state: ConversationScreenState): boolean => state.showRightPanel
);

export const isMessageSelectionMode = createSelector(
  getConversationScreenState,
  (state: ConversationScreenState): boolean => state.selectedMessageIds.length > 0
);

export const getSelectedMessageIds = createSelector(
  getConversationScreenState,
  (state: ConversationScreenState): Array<string> => state.selectedMessageIds
);

export const isMessageSelected = (messageId: string) =>
  createSelector(getConversationScreenState, (state: ConversationScreenState): boolean =>
    state.selectedMessageIds.includes(messageId)
  );
