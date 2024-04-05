import { createContext, useContext } from 'react';

export type ScrollToLoadedReasons =
  | 'quote-or-search-result'
  | 'go-to-bottom'
  | 'unread-indicator'
  | 'load-more-top'
  | 'load-more-bottom';

export const ScrollToLoadedMessageContext = createContext(
  (_loadedMessageIdToScrollTo: string, _reason: ScrollToLoadedReasons) => {}
);

export function useScrollToLoadedMessage() {
  return useContext(ScrollToLoadedMessageContext);
}
