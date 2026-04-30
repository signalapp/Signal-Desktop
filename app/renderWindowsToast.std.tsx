// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { WindowsNotificationData } from '../ts/services/notifications.preload.ts';

import { NotificationType } from '../ts/types/notifications.std.ts';
import { missingCaseError } from '../ts/util/missingCaseError.std.ts';
import {
  cancelPresentingRoute,
  showConversationRoute,
  showWindowRoute,
  startCallLobbyRoute,
} from '../ts/util/signalRoutes.std.ts';

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
  let launch: URL;

  let audio: ReactNode | undefined;

  // Note:
  //   1) this maps to the notify() function in services/notifications.ts
  //   2) this also maps to the url-handling in main.ts
  if (type === NotificationType.Message || type === NotificationType.Reaction) {
    launch = showConversationRoute.toAppUrl({
      token,
    });
    audio = <Audio src="ms-winsoundevent:Notification.IM" />;
  } else if (type === NotificationType.IncomingGroupCall) {
    launch = startCallLobbyRoute.toAppUrl({
      token,
    });
  } else if (type === NotificationType.IncomingCall) {
    launch = showWindowRoute.toAppUrl({});
  } else if (type === NotificationType.IsPresenting) {
    launch = cancelPresentingRoute.toAppUrl({});
  } else {
    throw missingCaseError(type);
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
