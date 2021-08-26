import { remote } from 'electron';
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
    remote.app.on('browser-window-focus', onFocusCallback);
    remote.app.on('browser-window-blur', onBlurCallback);
    return () => {
      remote.app.removeListener('browser-window-blur', onBlurCallback);
      remote.app.removeListener('browser-window-focus', onFocusCallback);
    };
  });

  return isFocused;
}
