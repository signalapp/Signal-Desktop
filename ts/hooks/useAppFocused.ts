import { remote } from 'electron';
import { useCallback, useEffect, useState } from 'react';
import { isElectronWindowFocused } from '../session/utils/WindowUtils';

export function useAppIsFocused() {
  const [isAppFocused, setIsAppFocused] = useState(false);

  useEffect(() => {
    setIsAppFocused(isElectronWindowFocused());
  }, []);

  const onFocusCallback = useCallback(
    (_event, win) => {
      if (win.webContents.id === 1) {
        setIsAppFocused(true);
      }
    },
    [setIsAppFocused]
  );

  const onBlurCallback = useCallback(
    (_event, win) => {
      if (win.webContents.id === 1) {
        setIsAppFocused(false);
      }
    },
    [setIsAppFocused]
  );

  useEffect(() => {
    remote.app.on('browser-window-focus', onFocusCallback);
    remote.app.on('browser-window-blur', onBlurCallback);
    return () => {
      remote.app.removeListener('browser-window-blur', onBlurCallback);
      remote.app.removeListener('browser-window-focus', onFocusCallback);
    };
  });

  return isAppFocused;
}
