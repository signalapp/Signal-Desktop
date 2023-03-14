// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';
import { activeWindowService } from '../../context/activeWindowService';
import { config } from '../../context/config';
import { createNativeThemeListener } from '../../context/createNativeThemeListener';
import { createSetting } from '../../util/preload';
import { environment } from '../../context/environment';
import { getClassName } from '../../OS';
import { i18n } from '../../context/i18n';
import { waitForSettingsChange } from '../../context/waitForSettingsChange';

async function executeMenuRole(
  role: MenuItemConstructorOptions['role']
): Promise<void> {
  await ipcRenderer.invoke('executeMenuRole', role);
}

const environments: Array<string> = [environment];

if (config.appInstance) {
  environments.push(String(config.appInstance));
}

let platform = '';
if (process.platform === 'darwin') {
  if (process.arch === 'arm64') {
    platform = ` (${i18n('appleSilicon')})`;
  } else {
    platform = ' (Intel)';
  }
}

const environmentText = `${environments.join(' - ')}${platform}`;
const hasCustomTitleBar = ipcRenderer.sendSync('getHasCustomTitleBar');

const Signal = {
  AboutWindow: {
    environmentText,
    executeMenuRole,
    hasCustomTitleBar,
    i18n,
    version: String(config.version),
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);

// TODO DESKTOP-5054
const SignalContext = {
  activeWindowService,
  OS: {
    getClassName,
    hasCustomTitleBar: () => hasCustomTitleBar,
  },
  Settings: {
    themeSetting: createSetting('themeSetting', { setter: false }),
    waitForChange: waitForSettingsChange,
  },
  nativeThemeListener: createNativeThemeListener(ipcRenderer, window),
};
contextBridge.exposeInMainWorld('SignalContext', SignalContext);
