// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { session } from 'electron';
import { v4 as uuid } from 'uuid';

import { updateDefaultSession } from '../../../app/updateDefaultSession.main.js';

describe('updateDefaultSession', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('sets the spellcheck URL', () => {
    const sesh = session.fromPartition(uuid());
    const stub = sandbox.stub(sesh, 'setSpellCheckerDictionaryDownloadURL');

    const logger = {
      fatal: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub(),
      trace: sandbox.stub(),
      child: sandbox.stub(),
    };
    updateDefaultSession(sesh, logger);

    sinon.assert.calledOnce(stub);
    sinon.assert.calledWith(
      stub,
      `https://updates.signal.org/desktop/hunspell_dictionaries/${process.versions.electron}/`
    );
    sinon.assert.notCalled(logger.fatal);
    sinon.assert.notCalled(logger.error);
    sinon.assert.notCalled(logger.warn);
    sinon.assert.notCalled(logger.info);
    sinon.assert.notCalled(logger.debug);
    sinon.assert.notCalled(logger.trace);
    sinon.assert.notCalled(logger.child);
  });
});
