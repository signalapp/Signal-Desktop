// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { NotificationType } from '../ts/types/notifications.std.ts';
import { missingCaseError } from '../ts/util/missingCaseError.std.ts';
import {
  cancelPresentingRoute,
  showConversationRoute,
  showWindowRoute,
  startCallLobbyRoute,
} from '../ts/util/signalRoutes.std.ts';

// Note:
//   1) this maps to the notify() function in services/notifications.ts
//   2) this also maps to the url-handling in main.ts
export function getNotificationRouteUrl(
  type: NotificationType,
  token: string
): URL {
  let launch: URL;

  if (
    type === NotificationType.Message ||
    type === NotificationType.Reaction ||
    type === NotificationType.UnreadReminder
  ) {
    launch = showConversationRoute.toAppUrl({
      token,
    });
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

  return launch;
}
