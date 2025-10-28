// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getHttpErrorCode } from '../../../jobs/helpers/getHttpErrorCode.std.js';

describe('getHttpErrorCode', () => {
  it('returns -1 if not passed an object', () => {
    assert.strictEqual(getHttpErrorCode(undefined), -1);
    assert.strictEqual(getHttpErrorCode(null), -1);
    assert.strictEqual(getHttpErrorCode(404), -1);
  });

  it('returns -1 if passed an object lacking a valid code', () => {
    assert.strictEqual(getHttpErrorCode({}), -1);
    assert.strictEqual(getHttpErrorCode({ code: 'garbage' }), -1);
    assert.strictEqual(
      getHttpErrorCode({ httpError: { code: 'garbage' } }),
      -1
    );
  });

  it('returns the top-level error code if it exists', () => {
    assert.strictEqual(getHttpErrorCode({ code: 404 }), 404);
    assert.strictEqual(getHttpErrorCode({ code: '404' }), 404);
  });

  it('returns a nested error code if available', () => {
    assert.strictEqual(getHttpErrorCode({ httpError: { code: 404 } }), 404);
    assert.strictEqual(getHttpErrorCode({ httpError: { code: '404' } }), 404);
  });

  it('"prefers" the first valid error code it finds if there is ambiguity', () => {
    assert.strictEqual(
      getHttpErrorCode({ code: '404', httpError: { code: 999 } }),
      404
    );
    assert.strictEqual(
      getHttpErrorCode({ code: 'garbage', httpError: { code: 404 } }),
      404
    );
  });
});
