import { useSelector } from 'react-redux';
import { StateType } from '../state/reducer';

export const useWeAreAdmin = (convoId?: string) =>
  useSelector((state: StateType) => {
    if (!convoId) {
      return false;
    }
    const convo = state.conversations.conversationLookup[convoId];
    if (!convo) {
      return false;
    }
    return convo.weAreAdmin;
  });
