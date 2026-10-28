// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { WindowsNotificationData } from '../ts/services/notifications.preload.ts';

import { NotificationType } from '../ts/types/notifications.std.ts';
import { getNotificationRouteUrl } from './getNotificationRouteUrl.std.ts';

function pathToUri(path: string) {
  return `file:///${encodeURI(path.replace(/\\/g, '/'))}`;
}

function Toast(props: {
  launch: string;
  // Note: though React doesn't like it, Windows seems to require that this be camelcase
  activationType: string;
  children: ReactNode;
}) {
  return createElement('toast', props);
}
function Visual(props: { children: ReactNode }) {
  return createElement('visual', props);
}
function Binding(props: { template: string; children: ReactNode }) {
  return createElement('binding', props);
}
function Text(props: { id: string; children: ReactNode }) {
  return createElement('text', props);
}
function Image(props: { id: string; src: string; 'hint-crop': string }) {
  return createElement('image', props);
}
function Audio(props: { src: string }) {
  return createElement('audio', props);
}

export function renderWindowsToast({
  avatarPath,
  body,
  heading,
  token,
  type,
}: WindowsNotificationData): string {
  // Note: with these templates, the first <text> is one line, bolded
  //   https://learn.microsoft.com/en-us/previous-versions/windows/apps/hh761494(v=win.10)?redirectedfrom=MSDN#toastimageandtext02
  //   https://learn.microsoft.com/en-us/previous-versions/windows/apps/hh761494(v=win.10)?redirectedfrom=MSDN#toasttext02

  const image = avatarPath ? (
    <Image id="1" src={pathToUri(avatarPath)} hint-crop="circle" />
  ) : null;
  const template = avatarPath ? 'ToastImageAndText02' : 'ToastText02';
  const launch = getNotificationRouteUrl(type, token);

  let audio: ReactNode | undefined;
  if (
    type === NotificationType.Message ||
    type === NotificationType.Reaction ||
    type === NotificationType.UnreadReminder
  ) {
    audio = <Audio src="ms-winsoundevent:Notification.IM" />;
  }

  return renderToStaticMarkup(
    <Toast launch={launch.href} activationType="protocol">
      <Visual>
        <Binding template={template}>
          {image}
          <Text id="1">{heading}</Text>
          <Text id="2">{body}</Text>
        </Binding>
      </Visual>
      {audio}
    </Toast>
  );
}
