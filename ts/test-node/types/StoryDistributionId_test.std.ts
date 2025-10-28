// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';
import * as sinon from 'sinon';

import type { LoggerType } from '../../types/Logging.std.js';
import { normalizeStoryDistributionId } from '../../types/StoryDistributionId.std.js';

describe('StoryDistributionId', () => {
  let warn: sinon.SinonStub;
  let logger: Pick<LoggerType, 'warn'>;

  beforeEach(() => {
    warn = sinon.stub();
    logger = { warn };
  });

  describe('normalizeStoryDistributionId', () => {
    it('converts uuid to lower case', () => {
      const uuid = generateUuid();
      assert.strictEqual(
        normalizeStoryDistributionId(uuid, 'context 1', logger),
        uuid
      );
      assert.strictEqual(
        normalizeStoryDistributionId(uuid.toUpperCase(), 'context 2', logger),
        uuid
      );

      sinon.assert.notCalled(warn);
    });

    it("warns if passed a string that's not a UUID", () => {
      normalizeStoryDistributionId('not-UUID-at-all', 'context 3', logger);
      sinon.assert.calledOnce(warn);
      sinon.assert.calledWith(
        warn,
        'Normalizing invalid story distribution id: ' +
          'not-UUID-at-all to not-uuid-at-all in ' +
          'context "context 3"'
      );
    });
  });
});
