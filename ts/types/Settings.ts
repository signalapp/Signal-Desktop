// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';
import os from 'os';

import * as OS from '../OS';
import { isProduction } from '../util/version';

const MIN_WINDOWS_VERSION = '8.0.0';

export enum AudioNotificationSupport {
  None,
  Native,
  Custom,
}

export function getAudioNotificationSupport(): AudioNotificationSupport {
  if (OS.isWindows(MIN_WINDOWS_VERSION) || OS.isMacOS()) {
    return AudioNotificationSupport.Native;
  }
  if (OS.isLinux()) {
    return AudioNotificationSupport.Custom;
  }
  return AudioNotificationSupport.None;
}

export const isAudioNotificationSupported = (): boolean =>
  getAudioNotificationSupport() !== AudioNotificationSupport.None;

// Using `Notification::tag` has a bug on Windows 7:
// https://github.com/electron/electron/issues/11189
export const isNotificationGroupingSupported = (): boolean =>
  !OS.isWindows() || OS.isWindows(MIN_WINDOWS_VERSION);

// Login item settings are only supported on macOS and Windows, according to [Electron's
//   docs][0].
// [0]: https://www.electronjs.org/docs/api/app#appsetloginitemsettingssettings-macos-windows
export const isAutoLaunchSupported = (): boolean =>
  OS.isWindows() || OS.isMacOS();

// the "hide menu bar" option is specific to Windows and Linux
export const isHideMenuBarSupported = (): boolean => !OS.isMacOS();

// the "draw attention on notification" option is specific to Windows and Linux
export const isDrawAttentionSupported = (): boolean => !OS.isMacOS();

/**
 * Returns `true` if you can minimize the app to the system tray. Users can override this
 * option with a command line flag, but that is not officially supported.
 */
export const isSystemTraySupported = (appVersion: string): boolean =>
  // We eventually want to support Linux in production.
  OS.isWindows() || (OS.isLinux() && !isProduction(appVersion));

export const isAutoDownloadUpdatesSupported = (): boolean =>
  OS.isWindows() || OS.isMacOS();

export const shouldHideExpiringMessageBody = (): boolean =>
  OS.isWindows() || (OS.isMacOS() && semver.lt(os.release(), '21.1.0'));
