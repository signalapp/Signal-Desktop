import * as OS from '../OS';

export const isAudioNotificationSupported = () =>
  OS.isWindows() || OS.isMacOS();
