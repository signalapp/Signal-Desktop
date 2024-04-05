import { createContext, useContext } from 'react';

/**
 * When the message is rendered as part of the detailView (right panel) we disable onClick and make some other minor UI changes
 */
export const IsDetailMessageViewContext = createContext<boolean>(false);

export function useIsDetailMessageView() {
  return useContext(IsDetailMessageViewContext);
}
