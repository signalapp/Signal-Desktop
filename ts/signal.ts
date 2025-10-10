// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// The idea with this file is to make it webpackable for the style guide

import OS from './util/os/osMain.js';
import { isProduction } from './util/version.js';
import { DataReader, DataWriter } from './sql/Client.js';

// Processes / Services
import { calling } from './services/calling.js';
import * as storage from './services/storage.js';
import { backupsService } from './services/backups/index.js';
import * as donations from './services/donations.js';

import type { SignalCoreType } from './window.d.ts';

export const setup = (): SignalCoreType => {
  // Only for testing
  const Services = {
    storage,
    calling,
    donations,
    backups: backupsService,
  };

  return {
    OS,

    ...(isProduction(window.getVersion())
      ? {}
      : {
          Services,

          DataReader,
          DataWriter,
        }),
  };
};
