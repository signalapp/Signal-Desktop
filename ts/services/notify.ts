// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Sound } from '../util/Sound';
import {
  AudioNotificationSupport,
  getAudioNotificationSupport,
} from '../types/Settings';
import * as OS from '../OS';

function filter(text: string) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type NotificationType = {
  icon: string;
  message: string;
  onNotificationClick: () => void;
  silent: boolean;
  title: string;
};

export function notify({
  icon,
  message,
  onNotificationClick,
  silent,
  title,
}: NotificationType): Notification {
  const audioNotificationSupport = getAudioNotificationSupport();

  const notification = new window.Notification(title, {
    body: OS.isLinux() ? filter(message) : message,
    icon,
    silent:
      silent || audioNotificationSupport !== AudioNotificationSupport.Native,
  });
  notification.onclick = onNotificationClick;

  if (!silent && audioNotificationSupport === AudioNotificationSupport.Custom) {
    // We kick off the sound to be played. No neet to await it.
    new Sound({ src: 'sounds/notification.ogg' }).play();
  }

  return notification;
}
