// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { run } from 'endanger';

import migrateBackboneToRedux from './rules/migrateBackboneToRedux';
import packageJsonVersionsShouldBePinned from './rules/packageJsonVersionsShouldBePinned';

function isGitDeletedError(error: unknown) {
  return (
    typeof error === 'object' &&
    error != null &&
    error['exitCode'] === 128 &&
    error['command']?.startsWith('git show ')
  );
}

async function main() {
  try {
    await run(migrateBackboneToRedux(), packageJsonVersionsShouldBePinned());
  } catch (error: unknown) {
    if (!isGitDeletedError(error)) {
      throw error;
    }
  }
}

main();
