const { take } = require('lodash');
const { getRecentEmojis } = require('./data');

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
