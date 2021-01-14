// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

//      toLogFormat :: Error -> String
exports.toLogFormat = error => {
  if (!error) {
    return error;
  }

  if (error && error.stack) {
    return error.stack;
  }

  return error.toString();
};
