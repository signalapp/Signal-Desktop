// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const semver = require('semver');

exports.isBeta = version => semver.parse(version).prerelease[0] === 'beta';
