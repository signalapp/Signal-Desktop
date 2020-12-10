// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as semver from 'semver';

export const isBeta = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'beta';
