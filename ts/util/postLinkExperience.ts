// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MINUTE } from './durations';

class PostLinkExperience {
  private hasNotFinishedSync: boolean;

  constructor() {
    this.hasNotFinishedSync = false;
  }

  start() {
    this.hasNotFinishedSync = true;

    // timeout "post link" after 10 minutes in case the syncs don't complete
    // in time or are never called.
    setTimeout(() => {
      this.stop();
    }, 10 * MINUTE);
  }

  stop() {
    this.hasNotFinishedSync = false;
  }

  isActive(): boolean {
    return this.hasNotFinishedSync === true;
  }
}

export const postLinkExperience = new PostLinkExperience();
