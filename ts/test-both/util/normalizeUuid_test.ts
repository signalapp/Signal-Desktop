// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';
import * as sinon from 'sinon';

import type { LoggerType } from '../../types/Logging';
import { normalizeUuid } from '../../util/normalizeUuid';

describe('normalizeUuid', () => {
  let warn: sinon.SinonStub;
  let logger: Pick<LoggerType, 'warn'>;

  beforeEach(() => {
    warn = sinon.stub();
    logger = { warn };
  });

  it('converts uuid to lower case', () => {
    const uuid = generateUuid();
    assert.strictEqual(normalizeUuid(uuid, 'context 1', logger), uuid);
    assert.strictEqual(
      normalizeUuid(uuid.toUpperCase(), 'context 2', logger),
      uuid
    );

    sinon.assert.notCalled(warn);
  });

  it("warns if passed a string that's not a UUID", () => {
    normalizeUuid('not-UUID-at-all', 'context 3', logger);
    sinon.assert.calledOnce(warn);
    sinon.assert.calledWith(
      warn,
      'Normalizing invalid uuid: not-UUID-at-all to not-uuid-at-all in ' +
        'context "context 3"'
    );
  });
});
