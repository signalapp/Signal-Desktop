// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServerAlert } from '../state/ducks/server';

export function handleServerAlerts(alerts: Array<ServerAlert>): void {
  window.reduxActions.server.updateServerAlerts(alerts);
}
