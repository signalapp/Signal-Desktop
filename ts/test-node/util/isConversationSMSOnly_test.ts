// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { generateAci } from '../../types/ServiceId';

import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';

const serviceId = generateAci();

describe('isConversationSMSOnly', () => {
  it('returns false if passed an undefined type', () => {
    assert.isFalse(
      isConversationSMSOnly({
        type: undefined,
      })
    );
  });

  ['direct', 'private'].forEach(type => {
    it(`requires an e164 but no serviceId, type ${type}`, () => {
      assert.isFalse(isConversationSMSOnly({ type }));
      assert.isFalse(isConversationSMSOnly({ type, serviceId }));
      assert.isFalse(isConversationSMSOnly({ type, e164: 'e164', serviceId }));
      assert.isTrue(isConversationSMSOnly({ type, e164: 'e164' }));
    });
  });

  it('returns false for groups', () => {
    assert.isFalse(isConversationSMSOnly({ type: 'group' }));
  });
});
