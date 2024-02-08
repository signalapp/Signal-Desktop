// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getParticipantName } from '../../util/callingGetParticipantName';

describe('getParticipantName', () => {
  it('returns the first name if available', () => {
    const participant = {
      firstName: 'Foo',
      title: 'Foo Bar',
    };

    assert.strictEqual(getParticipantName(participant), 'Foo');
  });

  it('returns the title if the first name is unavailable', () => {
    const participant = { title: 'Foo Bar' };

    assert.strictEqual(getParticipantName(participant), 'Foo Bar');
  });

  it('returns system given name if available', () => {
    const participant = {
      firstName: 'Foo',
      systemGivenName: 'Foo from that party',
      title: 'Foo Bar',
    };

    assert.strictEqual(getParticipantName(participant), 'Foo from that party');
  });

  it('returns system nickname if available', () => {
    const participant = {
      firstName: 'Foo',
      systemGivenName: 'Foo from that party',
      systemNickname: 'Foo-chan',
      title: 'Foo Bar',
    };

    assert.strictEqual(getParticipantName(participant), 'Foo-chan');
  });
});
