// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('os');

// os.hostname() doesn't work on Windows 7 anymore
// See: https://github.com/electron/electron/issues/34404
if (process.platform === 'win32' && semver.satisfies(os.release(), '6.1.x')) {
  os.hostname = () => 'Desktop';
}
