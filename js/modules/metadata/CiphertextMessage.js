// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

module.exports = {
  CURRENT_VERSION: 3,

  // This matches Envelope.Type.CIPHERTEXT
  WHISPER_TYPE: 1,
  // This matches Envelope.Type.PREKEY_BUNDLE
  PREKEY_TYPE: 3,

  SENDERKEY_TYPE: 4,
  SENDERKEY_DISTRIBUTION_TYPE: 5,

  ENCRYPTED_MESSAGE_OVERHEAD: 53,
};
