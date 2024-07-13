// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  FIRST_STRONG_ISOLATE as FSI,
  POP_DIRECTIONAL_ISOLATE as PSI,
  LTR_ISOLATE,
  POP_DIRECTIONAL_FORMATTING,
  RTL_ISOLATE,
  _bidiIsolate,
  LTR_EMBEDDING,
  LTR_OVERRIDE,
  RTL_EMBEDDING,
  RTL_OVERRIDE,
} from '../../util/unicodeBidi';

function debugUnicode(text: string) {
  return text
    .split('')
    .map(char => char.charCodeAt(0).toString(16))
    .join(' ');
}

function assertEqual(actual: string, expected: string) {
  assert.equal(debugUnicode(actual), debugUnicode(expected));
}

describe('_bidiIsolate', () => {
  it('returns a string with bidi isolate characters', () => {
    const actual = _bidiIsolate('Hello');
    assertEqual(actual, `${FSI}Hello${PSI}`);
  });

  it('strips unopened pop isolate characters', () => {
    const actual = _bidiIsolate(`${PSI}Hello`);
    assertEqual(actual, `${FSI}Hello${PSI}`);
  });

  it('strips unopened pop formatting characters', () => {
    const actual = _bidiIsolate(`${POP_DIRECTIONAL_FORMATTING}Hello`);
    assertEqual(actual, `${FSI}Hello${PSI}`);
  });

  it('closes isolates that were left open', () => {
    const actual = _bidiIsolate(`${LTR_ISOLATE}${RTL_ISOLATE}${FSI}Hello`);
    assertEqual(
      actual,
      `${FSI}${LTR_ISOLATE}${RTL_ISOLATE}${FSI}Hello${PSI}${PSI}${PSI}${PSI}`
    );
  });

  it('closes overrides that were left open', () => {
    const actual = _bidiIsolate(`${LTR_OVERRIDE}${RTL_OVERRIDE}Hello`);
    assertEqual(
      actual,
      `${FSI}${LTR_OVERRIDE}${RTL_OVERRIDE}Hello${POP_DIRECTIONAL_FORMATTING}${POP_DIRECTIONAL_FORMATTING}${PSI}`
    );
  });

  it('closes formatting that was left open', () => {
    const actual = _bidiIsolate(`${LTR_EMBEDDING}${RTL_EMBEDDING}Hello`);
    assertEqual(
      actual,
      `${FSI}${LTR_EMBEDDING}${RTL_EMBEDDING}Hello${POP_DIRECTIONAL_FORMATTING}${POP_DIRECTIONAL_FORMATTING}${PSI}`
    );
  });

  it('leaves properly balanced isolates alone', () => {
    const actual = _bidiIsolate(
      `${FSI}${LTR_ISOLATE}${RTL_ISOLATE}${PSI}${PSI}${PSI}Hello`
    );
    assertEqual(
      actual,
      `${FSI}${FSI}${LTR_ISOLATE}${RTL_ISOLATE}${PSI}${PSI}${PSI}Hello${PSI}`
    );
  });

  it('leaves properly balanced overrides alone', () => {
    const actual = _bidiIsolate(
      `${LTR_OVERRIDE}${RTL_OVERRIDE}${POP_DIRECTIONAL_FORMATTING}${POP_DIRECTIONAL_FORMATTING}Hello`
    );
    assertEqual(
      actual,
      `${FSI}${LTR_OVERRIDE}${RTL_OVERRIDE}${POP_DIRECTIONAL_FORMATTING}${POP_DIRECTIONAL_FORMATTING}Hello${PSI}`
    );
  });

  it('leaves properly balanced formatting alone', () => {
    const actual = _bidiIsolate(
      `${LTR_EMBEDDING}${RTL_EMBEDDING}${POP_DIRECTIONAL_FORMATTING}${POP_DIRECTIONAL_FORMATTING}Hello`
    );
    assertEqual(
      actual,
      `${FSI}${LTR_EMBEDDING}${RTL_EMBEDDING}${POP_DIRECTIONAL_FORMATTING}${POP_DIRECTIONAL_FORMATTING}Hello${PSI}`
    );
  });
});
