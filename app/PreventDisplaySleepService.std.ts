// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { PowerSaveBlocker } from 'electron';
import { createLogger } from '../ts/logging/log.std.js';

const log = createLogger('PreventDisplaySleepService');

export class PreventDisplaySleepService {
  private blockerId: undefined | number;

  constructor(private powerSaveBlocker: PowerSaveBlocker) {}

  isEnabled(): boolean {
    return this.blockerId !== undefined;
  }

  setEnabled(isEnabled: boolean): void {
    log.info(
      `Prevent display sleep service: ${
        isEnabled ? 'preventing' : 'allowing'
      } display sleep`
    );

    if (isEnabled) {
      this.#enable();
    } else {
      this.#disable();
    }
  }

  #enable(): void {
    if (this.blockerId !== undefined) {
      return;
    }
    this.blockerId = this.powerSaveBlocker.start('prevent-display-sleep');
  }

  #disable(): void {
    if (this.blockerId === undefined) {
      return;
    }
    this.powerSaveBlocker.stop(this.blockerId);
    delete this.blockerId;
  }
}
