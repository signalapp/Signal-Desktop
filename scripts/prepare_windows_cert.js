// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const fs = require('fs');
const _ = require('lodash');

const packageJson = require('../package.json');

// We have different windows certificates used in each of our build machines, and this
//   script makes it easier to ready the app to build on a given machine.

// -------

const KEY = 'build.win.certificateSha1';
const DEFAULT_VALUE = '8C9A0B5C852EC703D83EF7BFBCEB54B796073759';

const BUILDER_A = '507769334DA990A8DDE858314B0CDFC228E7CFA1';
const BUILDER_B = 'C689B0988CA1A7DF99E4CE4433AC7EA8B82F8D41';

let targetValue = DEFAULT_VALUE;

if (process.env.WINDOWS_BUILDER === 'A') {
  targetValue = BUILDER_A;
}
if (process.env.WINDOWS_BUILDER === 'B') {
  targetValue = BUILDER_B;
}

// -------

function checkValue(object, objectPath, expected) {
  const actual = _.get(object, objectPath);
  if (actual !== expected) {
    throw new Error(`${objectPath} was ${actual}; expected ${expected}`);
  }
}

// ------

checkValue(packageJson, KEY, DEFAULT_VALUE);

// -------

_.set(packageJson, KEY, targetValue);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));
