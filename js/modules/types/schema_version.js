const isNumber = require('lodash/isNumber');


exports.isValid = value =>
  isNumber(value) && value >= 0;
