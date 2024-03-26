import { createContext, useContext } from 'react';

export const IsMessageVisibleContext = createContext(false);

export function useIsMessageVisible() {
  return useContext(IsMessageVisibleContext);
}
