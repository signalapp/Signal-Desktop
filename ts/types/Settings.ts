// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as OS from '../OS';

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

// the "hide menu bar" option is specific to Windows and Linux
export const isHideMenuBarSupported = (): boolean => !OS.isMacOS();

// the "draw attention on notification" option is specific to Windows and Linux
export const isDrawAttentionSupported = (): boolean => !OS.isMacOS();
