// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Ensuring that the root directory is the same as this file before we load any
// danger code. This is needed so we can run danger with the danger/package.json
// file in CI
process.chdir(__dirname);
require('./danger/rules.ts');
