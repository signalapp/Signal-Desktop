// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isFileDangerous } from '../../util/isFileDangerous';

describe('isFileDangerous', () => {
  it('returns false for images', async () => {
    assert.strictEqual(await isFileDangerous('dog.gif'), false);
    assert.strictEqual(await isFileDangerous('cat.jpg'), false);
  });

  it('returns false for documents', async () => {
    assert.strictEqual(await isFileDangerous('resume.docx'), false);
    assert.strictEqual(await isFileDangerous('price_list.pdf'), false);
  });

  it('returns true for executable files', async () => {
    assert.strictEqual(await isFileDangerous('run.exe'), true);
    assert.strictEqual(await isFileDangerous('install.pif'), true);
  });

  it('returns true for Microsoft settings files', async () => {
    assert.strictEqual(await isFileDangerous('downl.SettingContent-ms'), true);
  });

  it('returns false for non-dangerous files that end in ".", which can happen on Windows', async () => {
    assert.strictEqual(await isFileDangerous('dog.png.'), false);
    assert.strictEqual(await isFileDangerous('resume.docx.'), false);
  });

  it('returns true for dangerous files that end in ".", which can happen on Windows', async () => {
    assert.strictEqual(await isFileDangerous('run.exe.'), true);
    assert.strictEqual(await isFileDangerous('install.pif.'), true);
  });

  it('returns false for empty filename', async () => {
    assert.strictEqual(await isFileDangerous(''), false);
  });

  it('returns false for exe at various parts of filename', async () => {
    assert.strictEqual(await isFileDangerous('.exemanifesto.txt'), false);
    assert.strictEqual(await isFileDangerous('runexe'), false);
    assert.strictEqual(await isFileDangerous('run_exe'), false);
  });

  it('returns true for upper-case EXE', async () => {
    assert.strictEqual(await isFileDangerous('run.EXE'), true);
  });
});
