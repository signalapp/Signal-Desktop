// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { nonRenderedRemoteParticipant } from '../../../util/ringrtc/nonRenderedRemoteParticipant.std.js';

describe('nonRenderedRemoteParticipant', () => {
  it('returns a video request object a width and height of 0', () => {
    assert.deepEqual(nonRenderedRemoteParticipant({ demuxId: 123 }), {
      demuxId: 123,
      width: 0,
      height: 0,
    });
  });
});
