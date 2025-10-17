// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AfterPackContext } from 'electron-builder';
import { afterSign as notarize } from './notarize.node.js';

// NOTE: It is AfterPackContext here even though it is afterSign.
// See: https://www.electron.build/configuration/configuration.html#aftersign
export async function afterSign(context: AfterPackContext): Promise<void> {
  // This must be the last step
  await notarize(context);
}
