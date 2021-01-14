// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { isNumber } = require('lodash');

exports.isValid = value => isNumber(value) && value >= 0;
