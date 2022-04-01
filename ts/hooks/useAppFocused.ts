import { app } from 'electron';
import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isElectronWindowFocused } from '../session/utils/WindowUtils';
import { setIsAppFocused } from '../state/ducks/section';
import { getIsAppFocused } from '../state/selectors/section';

export function useAppIsFocused() {
  const dispatch = useDispatch();
  const isFocused = useSelector(getIsAppFocused);

  useEffect(() => {
    dispatch(setIsAppFocused(isElectronWindowFocused()));
  }, []);

  const onFocusCallback = useCallback((_event, win) => {
    if (win.webContents.id === 1) {
      dispatch(setIsAppFocused(true));
    }
  }, []);

  const onBlurCallback = useCallback((_event, win) => {
    if (win.webContents.id === 1) {
      dispatch(setIsAppFocused(false));
    }
  }, []);

  useEffect(() => {
    // app.on('browser-window-focus', onFocusCallback);
    // app.on('browser-window-blur', onBlurCallback);
    return () => {
      // app.removeListener('browser-window-blur', onBlurCallback);
      // app.removeListener('browser-window-focus', onFocusCallback);
    };
  });

  return isFocused;
}
