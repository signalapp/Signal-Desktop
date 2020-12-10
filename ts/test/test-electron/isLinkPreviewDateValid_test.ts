import { assert } from 'chai';

import { isLinkPreviewDateValid } from '../../util/isLinkPreviewDateValid';

describe('isLinkPreviewDateValid', () => {
  it('returns false for non-numbers', () => {
    assert.isFalse(isLinkPreviewDateValid(null));
    assert.isFalse(isLinkPreviewDateValid(undefined));
    assert.isFalse(isLinkPreviewDateValid(Date.now().toString()));
    assert.isFalse(isLinkPreviewDateValid(new Date()));
  });

  it('returns false for zero', () => {
    assert.isFalse(isLinkPreviewDateValid(0));
    assert.isFalse(isLinkPreviewDateValid(-0));
  });

  it('returns false for NaN', () => {
    assert.isFalse(isLinkPreviewDateValid(0 / 0));
  });

  it('returns false for any infinite value', () => {
    assert.isFalse(isLinkPreviewDateValid(Infinity));
    assert.isFalse(isLinkPreviewDateValid(-Infinity));
  });

  it('returns false for timestamps more than a day from now', () => {
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    assert.isFalse(isLinkPreviewDateValid(Date.now() + twoDays));
  });

  it('returns true for timestamps before tomorrow', () => {
    assert.isTrue(isLinkPreviewDateValid(Date.now()));
    assert.isTrue(isLinkPreviewDateValid(Date.now() + 123));
    assert.isTrue(isLinkPreviewDateValid(Date.now() - 123));
    assert.isTrue(isLinkPreviewDateValid(new Date(1995, 3, 20).valueOf()));
    assert.isTrue(isLinkPreviewDateValid(new Date(1970, 3, 20).valueOf()));
    assert.isTrue(isLinkPreviewDateValid(new Date(1969, 3, 20).valueOf()));
    assert.isTrue(isLinkPreviewDateValid(1));
  });
});
