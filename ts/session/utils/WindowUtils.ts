import { app, BrowserWindow, remote } from 'electron';
import { useEffect, useState } from 'react';

export function isElectronWindowFocused() {
  const [yourBrowserWindow] = remote.BrowserWindow.getAllWindows();
  const isFocused = yourBrowserWindow?.isFocused() || false;

  return isFocused;
}
