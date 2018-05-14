import * as OS from '../OS';

const MIN_WINDOWS_VERSION = '8.0.0';

export const isAudioNotificationSupported = () =>
  OS.isWindows(MIN_WINDOWS_VERSION) || OS.isMacOS();

// Using `Notification::tag` has a bug on Windows 7:
// https://github.com/electron/electron/issues/11189
export const isNotificationGroupingSupported = () =>
  !OS.isWindows() || OS.isWindows(MIN_WINDOWS_VERSION);
