// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// The idea with this file is to make it webpackable for the style guide

import OS from './util/os/osMain.node.ts';
import { isProduction } from './util/version.std.ts';
import { DataReader, DataWriter } from './sql/Client.preload.ts';

// Processes / Services
import { calling } from './services/calling.preload.ts';
import * as storage from './services/storage.preload.ts';
import { backupsService } from './services/backups/index.preload.ts';
import * as donations from './services/donations.preload.ts';

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
