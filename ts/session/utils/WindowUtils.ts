import { remote } from 'electron';

export function isElectronWindowFocused() {
  const [yourBrowserWindow] = remote.BrowserWindow.getAllWindows();
  const isFocused = yourBrowserWindow?.isFocused() || false;

  return isFocused;
}
