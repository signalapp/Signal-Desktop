// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { take } = require('lodash');
const { getRecentEmojis } = require('../../ts/sql/Client').default;

module.exports = {
  getInitialState,
  load,
};

let initialState = null;

async function load() {
  const recents = await getRecentEmojisForRedux();

  initialState = {
    recents: take(recents, 32),
  };
}

async function getRecentEmojisForRedux() {
  const recent = await getRecentEmojis();
  return recent.map(e => e.shortName);
}

function getInitialState() {
  return initialState;
}
