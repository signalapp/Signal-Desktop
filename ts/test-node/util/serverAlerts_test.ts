// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getServerAlertToShow } from '../../util/handleServerAlerts.preload.js';
import { ServerAlert } from '../../types/ServerAlert.std.js';
import { DAY, MONTH, WEEK } from '../../util/durations/index.std.js';

describe('serverAlerts', () => {
  it('should prefer critical alerts', () => {
    assert.strictEqual(
      getServerAlertToShow({
        [ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE]: {
          firstReceivedAt: Date.now(),
        },
        [ServerAlert.IDLE_PRIMARY_DEVICE]: { firstReceivedAt: Date.now() },
      }),
      ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE
    );
  });
  it('should not show idle device warning if dismissed < 1 week', () => {
    assert.strictEqual(
      getServerAlertToShow({
        [ServerAlert.IDLE_PRIMARY_DEVICE]: {
          firstReceivedAt: Date.now() - MONTH,
          dismissedAt: Date.now() - DAY,
        },
      }),
      null
    );
  });
  it('should show idle device warning if dismissed > 1 week', () => {
    assert.strictEqual(
      getServerAlertToShow({
        [ServerAlert.IDLE_PRIMARY_DEVICE]: {
          firstReceivedAt: Date.now() - MONTH,
          dismissedAt: Date.now() - WEEK - 1,
        },
      }),
      ServerAlert.IDLE_PRIMARY_DEVICE
    );
  });
});
