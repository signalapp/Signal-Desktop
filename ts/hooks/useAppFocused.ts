import { ipcRenderer } from 'electron';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setIsAppFocused } from '../state/ducks/section';
import { getIsAppFocused } from '../state/selectors/section';

/**
 * This custom hook should be called on the top of the app only once.
 * It sets up a listener for events from main_node.ts and update the global redux state with the focused state.
 */
export function useAppIsFocused() {
  const dispatch = useDispatch();
  const isFocusedFromStore = useSelector(getIsAppFocused);

  const ipcCallback = (_event: unknown, isFocused: unknown) => {
    if (isFocusedFromStore !== isFocused) {
      dispatch(setIsAppFocused(Boolean(isFocused)));
    }
  };

  useEffect(() => {
    ipcRenderer.on('set-window-focus', ipcCallback);
    return () => {
      ipcRenderer.removeListener('set-window-focus', ipcCallback);
    };
  });

  return isFocusedFromStore;
}
