// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import moment from 'moment';

const HOUR = 1000 * 60 * 60;

export function formatDuration(seconds: number): string {
  const time = moment.utc(seconds * 1000);

  if (seconds > HOUR) {
    return time.format('H:mm:ss');
  }

  return time.format('m:ss');
}
