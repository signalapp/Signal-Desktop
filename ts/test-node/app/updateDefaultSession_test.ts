// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { session } from 'electron';
import { v4 as uuid } from 'uuid';

import { updateDefaultSession } from '../../../app/updateDefaultSession';

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
    const getLogger = sandbox.stub();

    updateDefaultSession(sesh, getLogger);

    sinon.assert.calledOnce(stub);
    sinon.assert.calledWith(
      stub,
      `https://updates.signal.org/desktop/hunspell_dictionaries/${process.versions.electron}/`
    );
    sinon.assert.notCalled(getLogger);
  });
});
