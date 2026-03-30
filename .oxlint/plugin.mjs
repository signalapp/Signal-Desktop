// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { enforceArrayBuffer } from './rules/enforceArrayBuffer.mjs';
import { enforceFileSuffix } from './rules/enforceFileSuffix.mjs';
import { enforceLicenseComments } from './rules/enforceLicenseComments.mjs';
import { enforceTw } from './rules/enforceTw.mjs';
import { enforceTypeAliasReadonlyDeep } from './rules/enforceTypeAliasReadonlyDeep.mjs';
import { noDisabledTests } from './rules/noDisabledTests.mjs';
import { noExtraneousDependencies } from './rules/noExtraneousDependencies.mjs';
import { noFocusedTests } from './rules/noFocusedTests.mjs';
import { noForIn } from './rules/noForIn.mjs';
import { noRestrictedPaths } from './rules/noRestrictedPaths.mjs';
import { noThen } from './rules/noThen.mjs';

/** @type {import("@typescript-eslint/utils").TSESLint.Linter.Plugin} */
const plugin = {
  meta: {
    name: 'signal-desktop',
    version: '0.0.0',
  },
  rules: {
    'enforce-array-buffer': enforceArrayBuffer,
    'enforce-file-suffix': enforceFileSuffix,
    'enforce-license-comments': enforceLicenseComments,
    'enforce-tw': enforceTw,
    'enforce-type-alias-readonlydeep': enforceTypeAliasReadonlyDeep,
    'no-disabled-tests': noDisabledTests,
    'no-extraneous-dependencies': noExtraneousDependencies,
    'no-focused-tests': noFocusedTests,
    'no-for-in': noForIn,
    'no-restricted-paths': noRestrictedPaths,
    'no-then': noThen,
  },
};

export default plugin;
