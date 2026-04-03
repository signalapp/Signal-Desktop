// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { afterSign as notarize } from './notarize.mjs';

/** @import { AfterPackContext } from 'electron-builder' */

/**
 * NOTE: It is AfterPackContext here even though it is afterSign.
 * See: https://www.electron.build/configuration/configuration.html#aftersign
 * @param {AfterPackContext} context
 * @returns {Promise<void>}
 */
export async function afterSign(context) {
  // This must be the last step
  await notarize(context);
}
