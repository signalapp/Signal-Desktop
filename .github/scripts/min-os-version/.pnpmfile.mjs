// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

//
// WARNING: Do not import (or even `import()`) any packages, they won't always be installed.
//

export const hooks = {
  /**
   * @param {any} config
   * @returns {any}
   */
  updateConfig(config) {
    return {
      ...config,
      verifyStoreIntegrity: process.env.CI
        ? false
        : config.verifyStoreIntegrity,
      verifyDepsBeforeRun:
        process.env.CI || process.env.SKIP_VERIFY_DEPS_BEFORE_RUN
          ? false
          : config.verifyDepsBeforeRun,
    };
  },
};
