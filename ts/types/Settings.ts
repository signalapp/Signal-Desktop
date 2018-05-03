import * as OS from '../OS';

const MIN_WINDOWS_VERSION = '8.0.0';

export const isAudioNotificationSupported = () =>
  OS.isWindows(MIN_WINDOWS_VERSION) || OS.isMacOS();
