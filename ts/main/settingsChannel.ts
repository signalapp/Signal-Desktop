// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain as ipc, BrowserWindow, session } from 'electron';

import { userConfig } from '../../app/user_config';
import { ephemeralConfig } from '../../app/ephemeral_config';
import { installPermissionsHandler } from '../../app/permissions';
import { strictAssert } from '../util/assert';
import {
  IPCEventsValuesType,
  IPCEventsCallbacksType,
} from '../util/createIPCEvents';

export class SettingsChannel {
  private mainWindow?: BrowserWindow;

  public setMainWindow(mainWindow: BrowserWindow | undefined): void {
    this.mainWindow = mainWindow;
  }

  public install(): void {
    this.installSetting('deviceName', { setter: false });

    // ChatColorPicker redux hookups
    this.installCallback('getCustomColors');
    this.installCallback('getConversationsWithCustomColor');
    this.installCallback('resetAllChatColors');
    this.installCallback('resetDefaultChatColor');
    this.installCallback('addCustomColor');
    this.installCallback('editCustomColor');
    this.installCallback('removeCustomColor');
    this.installCallback('removeCustomColorOnConversations');
    this.installCallback('setGlobalDefaultConversationColor');
    this.installCallback('getDefaultConversationColor');

    // Various callbacks
    this.installCallback('getAvailableIODevices');
    this.installCallback('isPrimary');
    this.installCallback('syncRequest');
    this.installCallback('isPhoneNumberSharingEnabled');

    // Getters only. These are set by the primary device
    this.installSetting('blockedCount', { setter: false });
    this.installSetting('linkPreviewSetting', { setter: false });
    this.installSetting('phoneNumberDiscoverabilitySetting', { setter: false });
    this.installSetting('phoneNumberSharingSetting', { setter: false });
    this.installSetting('readReceiptSetting', { setter: false });
    this.installSetting('typingIndicatorSetting', { setter: false });

    this.installSetting('themeSetting');
    this.installSetting('hideMenuBar');
    this.installSetting('systemTraySetting');

    this.installSetting('notificationSetting');
    this.installSetting('notificationDrawAttention');
    this.installSetting('audioNotification');
    this.installSetting('countMutedConversations');

    this.installSetting('spellCheck', {
      isEphemeral: true,
    });

    this.installSetting('autoDownloadUpdate');
    this.installSetting('autoLaunch');

    this.installSetting('alwaysRelayCalls');
    this.installSetting('callRingtoneNotification');
    this.installSetting('callSystemNotification');
    this.installSetting('incomingCallNotification');

    // Media settings
    this.installSetting('preferredAudioInputDevice');
    this.installSetting('preferredAudioOutputDevice');
    this.installSetting('preferredVideoInputDevice');

    this.installSetting('lastSyncTime');
    this.installSetting('universalExpireTimer');

    this.installSetting('zoomFactor');

    installPermissionsHandler({ session, userConfig });

    // These ones are different because its single source of truth is userConfig,
    // not IndexedDB
    ipc.on('settings:get:mediaPermissions', event => {
      event.sender.send(
        'settings:get-success:mediaPermissions',
        null,
        userConfig.get('mediaPermissions') || false
      );
    });
    ipc.on('settings:get:mediaCameraPermissions', event => {
      event.sender.send(
        'settings:get-success:mediaCameraPermissions',
        null,
        userConfig.get('mediaCameraPermissions') || false
      );
    });
    ipc.on('settings:set:mediaPermissions', (event, value) => {
      userConfig.set('mediaPermissions', value);

      // We reinstall permissions handler to ensure that a revoked permission takes effect
      installPermissionsHandler({ session, userConfig });

      event.sender.send('settings:set-success:mediaPermissions', null, value);
    });
    ipc.on('settings:set:mediaCameraPermissions', (event, value) => {
      userConfig.set('mediaCameraPermissions', value);

      // We reinstall permissions handler to ensure that a revoked permission takes effect
      installPermissionsHandler({ session, userConfig });

      event.sender.send(
        'settings:set-success:mediaCameraPermissions',
        null,
        value
      );
    });
  }

  public getSettingFromMainWindow<Name extends keyof IPCEventsValuesType>(
    name: Name
  ): Promise<IPCEventsValuesType[Name]> {
    const { mainWindow } = this;
    return new Promise((resolve, reject) => {
      ipc.once(`settings:get-success:${name}`, (_event, error, value) => {
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      });
      if (!mainWindow || !mainWindow.webContents) {
        reject(new Error('No main window available'));
        return;
      }
      mainWindow.webContents.send(`settings:get:${name}`);
    });
  }

  private installCallback<Name extends keyof IPCEventsCallbacksType>(
    name: Name
  ): void {
    ipc.on(`callbacks:call:${name}`, async (event, args) => {
      const { mainWindow } = this;
      const contents = event.sender;
      if (!mainWindow || !mainWindow.webContents) {
        return contents.send(
          `callbacks:call-success:${name}`,
          'Main window not found'
        );
      }

      mainWindow.webContents.send(`callbacks:call:${name}`, args);
      ipc.once(`callbacks:call-success:${name}`, (_event, error, value) => {
        if (contents.isDestroyed()) {
          return;
        }

        contents.send(`callbacks:call-success:${name}`, error, value);
      });
    });
  }

  private installSetting<Name extends keyof IPCEventsValuesType>(
    name: Name,
    {
      getter = true,
      setter = true,
      isEphemeral = false,
    }: { getter?: boolean; setter?: boolean; isEphemeral?: boolean } = {}
  ): void {
    if (getter) {
      ipc.on(`settings:get:${name}`, async event => {
        const { mainWindow } = this;
        if (mainWindow && mainWindow.webContents) {
          let error: Error | undefined;
          let value: unknown;
          try {
            value = await this.getSettingFromMainWindow(name);
          } catch (caughtError) {
            error = caughtError;
          }

          const contents = event.sender;
          if (contents.isDestroyed()) {
            return;
          }

          contents.send(`settings:get-success:${name}`, error, value);
        }
      });
    }

    if (!setter) {
      return;
    }

    ipc.on(`settings:set:${name}`, (event, value) => {
      if (isEphemeral) {
        strictAssert(name === 'spellCheck', 'Only spellCheck is ephemeral');
        ephemeralConfig.set('spell-check', value);
      }

      const { mainWindow } = this;
      if (mainWindow && mainWindow.webContents) {
        ipc.once(`settings:set-success:${name}`, (_event, error) => {
          const contents = event.sender;
          if (contents.isDestroyed()) {
            return;
          }

          contents.send(`settings:set-success:${name}`, error);
        });
        mainWindow.webContents.send(`settings:set:${name}`, value);
      }
    });
  }
}
