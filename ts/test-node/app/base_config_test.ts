// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { tmpdir } from 'os';
import { writeFileSync, unlinkSync } from 'fs';

import { v4 as generateGuid } from 'uuid';
import { assert } from 'chai';

import { start } from '../../../app/base_config';

describe('base_config', () => {
  let targetFile: string | undefined;

  function getNewPath() {
    return `${tmpdir()}/${generateGuid()}.txt`;
  }

  afterEach(() => {
    if (targetFile) {
      unlinkSync(targetFile);
    }
  });

  it('does not throw if file is missing', () => {
    const missingFile = getNewPath();
    const { _getCachedValue } = start('test', missingFile);

    assert.deepEqual(_getCachedValue(), Object.create(null));
  });

  it('successfully loads config file', () => {
    targetFile = getNewPath();

    const config = { a: 1, b: 2 };
    writeFileSync(targetFile, JSON.stringify(config));
    const { _getCachedValue } = start('test', targetFile);

    assert.deepEqual(_getCachedValue(), config);
  });

  it('throws if file is malformed', () => {
    targetFile = getNewPath();

    writeFileSync(targetFile, '{{ malformed JSON');

    const fileForClosure = targetFile;
    assert.throws(() => start('test', fileForClosure));
  });

  it('does not throw if file is empty', () => {
    targetFile = getNewPath();

    writeFileSync(targetFile, '');

    const { _getCachedValue } = start('test', targetFile);

    assert.deepEqual(_getCachedValue(), Object.create(null));
  });

  it('does not throw if file is malformed, with allowMalformedOnStartup', () => {
    targetFile = getNewPath();

    writeFileSync(targetFile, '{{ malformed JSON');
    const { _getCachedValue } = start('test', targetFile, {
      allowMalformedOnStartup: true,
    });

    assert.deepEqual(_getCachedValue(), Object.create(null));
  });
});
