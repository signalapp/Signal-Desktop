// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { AciString } from '../../types/ServiceId.std.ts';
import { isRelinkingToSameAccount } from '../../util/isRelinkingToSameAccount.std.ts';

const ACI_1 = '11111111-1111-4111-8111-111111111111' as AciString;
const ACI_2 = '22222222-2222-4222-8222-222222222222' as AciString;

const PHONE_1 = '111-111-1111';
const PHONE_2 = '222-222-2222';

describe('isRelinkingToSameAccount', () => {
  it('if ACIs and numbers match: true', () => {
    assert.isTrue(
      isRelinkingToSameAccount({
        newAci: ACI_1,
        newNumber: PHONE_1,
        previousAci: ACI_1,
        previousNumber: PHONE_1,
      })
    );
  });
  it("if ACIs match but numbers don't: true", () => {
    assert.isTrue(
      isRelinkingToSameAccount({
        newAci: ACI_1,
        newNumber: PHONE_2,
        previousAci: ACI_1,
        previousNumber: PHONE_1,
      })
    );
  });
  it("if ACIs don't match but numbers do: false", () => {
    assert.isFalse(
      isRelinkingToSameAccount({
        newAci: ACI_2,
        newNumber: PHONE_1,
        previousAci: ACI_1,
        previousNumber: PHONE_1,
      })
    );
  });
  it('if no ACI existed but number is same: true', () => {
    assert.isTrue(
      isRelinkingToSameAccount({
        newAci: ACI_1,
        newNumber: PHONE_1,
        previousAci: undefined,
        previousNumber: PHONE_1,
      })
    );
  });
  it('if no ACI existed but number is different: false', () => {
    assert.isFalse(
      isRelinkingToSameAccount({
        newAci: ACI_1,
        newNumber: PHONE_2,
        previousAci: undefined,
        previousNumber: PHONE_1,
      })
    );
  });
  it('if neither number nor ACI existed: false', () => {
    assert.isFalse(
      isRelinkingToSameAccount({
        newAci: ACI_1,
        newNumber: PHONE_1,
        previousAci: undefined,
        previousNumber: undefined,
      })
    );
  });
});
