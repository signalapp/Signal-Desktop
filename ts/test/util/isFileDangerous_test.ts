import { assert } from 'chai';

import { isFileDangerous } from '../../util/isFileDangerous';

describe('isFileDangerous', () => {
  it('returns false for images', () => {
    assert.strictEqual(isFileDangerous('dog.gif'), false);
    assert.strictEqual(isFileDangerous('cat.jpg'), false);
  });

  it('returns false for documents', () => {
    assert.strictEqual(isFileDangerous('resume.docx'), false);
    assert.strictEqual(isFileDangerous('price_list.pdf'), false);
  });

  it('returns true for executable files', () => {
    assert.strictEqual(isFileDangerous('run.exe'), true);
    assert.strictEqual(isFileDangerous('install.pif'), true);
  });

  it('returns false for empty filename', () => {
    assert.strictEqual(isFileDangerous(''), false);
  });

  it('returns false for exe at various parts of filename', () => {
    assert.strictEqual(isFileDangerous('.exemanifesto.txt'), false);
    assert.strictEqual(isFileDangerous('runexe'), false);
    assert.strictEqual(isFileDangerous('run_exe'), false);
  });

  it('returns true for upper-case EXE', () => {
    assert.strictEqual(isFileDangerous('run.EXE'), true);
  });
});
