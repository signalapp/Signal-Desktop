// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import path from 'node:path';
import { execSync } from 'node:child_process';

/** @import { AfterPackContext } from 'electron-builder' */

const FILES = [
  'resources/org.signalapp.enable-backups.policy',
  'resources/org.signalapp.view-aep.policy',
];

/**
 * @param {AfterPackContext} context
 * @returns {Promise<void>}
 */
export async function afterPack({ appOutDir, electronPlatformName }) {
  if (electronPlatformName !== 'linux') {
    return;
  }

  console.log('Ensuring Linux file permissions');

  for (const file of FILES) {
    const filePath = path.join(appOutDir, file);
    // u+rw g+r o+r
    const command = `chmod 644 "${filePath}"`;
    console.log(`Running: ${command}`);
    execSync(command);
  }
}
