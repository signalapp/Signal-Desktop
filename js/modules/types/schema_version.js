const { isNumber } = require('lodash');


exports.isValid = value =>
  isNumber(value) && value >= 0;
