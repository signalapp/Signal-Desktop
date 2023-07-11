// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { clipboard } from 'electron';
import { getLanguages } from '../../../app/spell_check';

type ContextMenuParams = {
  x: number;
  y: number;
  editFlags: {
    canUndo: boolean;
    canRedo: boolean;
    canCut: boolean;
    canPaste: boolean;
    canSelectAll: boolean;
    canCopy: boolean;
    canDelete: boolean;
    canEditRichly: boolean;
  };
  frame: Electron.WebFrameMain;
  linkURL: string;
  linkText: string;
  pageURL: string;
  frameURL: string;
  srcURL: string;
  mediaType: string;
  hasImageContents: boolean;
  isEditable: boolean;
  selectionText: string;
  titleText: string;
  altText: string;
  suggestedFilename: string;
  selectionRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selectionStartOffset: number;
  referrerPolicy: Electron.Referrer;
  misspelledWord: string;
  dictionarySuggestions: Array<string>;
  frameCharset: string;
  inputFieldType: string;
  spellcheckEnabled: boolean;
  menuSourceType: string;
  mediaFlags: Electron.MediaFlags;
};

describe('SpellCheck', () => {
  describe('getLanguages', () => {
    it('works with locale and base available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en-US', 'en'], 'en'), [
        'en-US',
      ]);
    });

    it('uses icu likely subtags rules to match languages', () => {
      assert.deepEqual(getLanguages(['fa-FR'], ['fa-IR'], 'en'), ['fa-IR']);
      assert.deepEqual(getLanguages(['zh'], ['zh-Hans-CN'], 'en'), [
        'zh-Hans-CN',
      ]);
      assert.deepEqual(
        getLanguages(['zh-HK'], ['zh-Hans-CN', 'zh-Hant-HK'], 'en'),
        ['zh-Hant-HK']
      );
    });

    it('matches multiple locales', () => {
      assert.deepEqual(
        getLanguages(['fr-FR', 'es'], ['fr', 'es-ES', 'en-US'], 'en'),
        ['fr', 'es-ES']
      );
    });

    it('works with only base locale available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en'], 'en'), ['en']);
    });

    it('works with only full locale available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en-CA', 'en-US'], 'en'), [
        'en-US',
      ]);
    });

    it('works with base provided and base available', () => {
      assert.deepEqual(getLanguages(['en'], ['en-CA', 'en-US', 'en'], 'en'), [
        'en',
      ]);
    });

    it('falls back to default', () => {
      assert.deepEqual(getLanguages(['fa-IR'], ['es-ES', 'fr-FR'], 'en'), [
        'en',
      ]);
    });

    it('matches en along with other languages', () => {
      assert.deepEqual(getLanguages(['en', 'fr'], ['fr', 'en'], 'en'), [
        'en',
        'fr',
      ]);
    });
  });
});

describe('context-menu copy & paste', () => {
  const params: ContextMenuParams = {
    x: 0,
    y: 0,
    editFlags: {
      canUndo: false,
      canRedo: false,
      canCut: false,
      canPaste: false,
      canSelectAll: false,
      canCopy: true,
      canDelete: false,
      canEditRichly: false,
    },
    frame: {} as Electron.WebFrameMain,
    linkURL: '',

    // Propiedades adicionales requeridas por 'ContextMenuParams'
    linkText: '',
    pageURL: '',
    frameURL: '',
    srcURL: '',
    mediaType: 'none',
    hasImageContents: false,
    isEditable: false,
    selectionText: 'This is a test message \n',
    titleText: '',
    altText: '',
    suggestedFilename: '',
    selectionRect: { x: 0, y: 0, width: 0, height: 0 },
    selectionStartOffset: 0,
    referrerPolicy: {} as Electron.Referrer,
    misspelledWord: '',
    dictionarySuggestions: [],
    frameCharset: '',
    inputFieldType: '',
    spellcheckEnabled: false,
    menuSourceType: 'none',
    mediaFlags: {} as Electron.MediaFlags,
  };

  beforeEach(() => {
    it('should not leave trailing a newline when copying text', () => {
      const copyText = params.selectionText.toString();
      clipboard.writeText(copyText);
      assert.notInclude(copyText, '\n');
    });
  });
});
