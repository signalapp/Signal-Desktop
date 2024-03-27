import { createContext, useContext } from 'react';

/**
 * This React context is used to share deeply in the tree of the ConversationListItem what is the ID we are currently rendering.
 * This is to avoid passing the prop to all the subtree component
 */
const ContextConversationId = createContext('');

export const ContextConversationProvider = ContextConversationId.Provider;

export function useConvoIdFromContext() {
  const convoId = useContext(ContextConversationId);
  return convoId;
}
