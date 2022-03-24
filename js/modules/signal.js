// The idea with this file is to make it webpackable for the style guide

const Crypto = require('./crypto');
const Data = require('../../ts/data/data');
const OS = require('../../ts/OS');
const Util = require('../../ts/util');

exports.setup = () => {
  Data.init();

  return {
    Crypto,
    Data,
    OS,
    Util,
  };
};
