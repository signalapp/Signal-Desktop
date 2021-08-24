// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This is a shim that gets inserted in place of `bindings` npm module when
// building sql worker bundle.
module.exports = (binding: string) => {
  if (binding === 'better_sqlite3.node') {
    // eslint-disable-next-line global-require, import/no-unresolved
    return require('better_sqlite3.node');
  }

  throw new Error(`Unknown binding ${binding}`);
};
