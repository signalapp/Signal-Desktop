// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { assert } from 'chai';
import * as sinon from 'sinon';
import type { IntlShape } from 'react-intl';
import { createIntl, createIntlCache } from 'react-intl';

import { StickerButton } from '../../../components/stickers/StickerButton';
import type { StickerPackType, StickerType } from '../../../state/ducks/stickers';
import type { LocalizerType } from '../../../types/Util';
import { HourCyclePreference } from '../../../types/I18N';

// Mock i18n implementation
const mockIntl = createIntl(
  {
    locale: 'en',
    messages: {},
    defaultRichTextElements: {},
    onError: () => {},
    onWarn: () => {},
  },
  createIntlCache()
);

const mockI18n = (() => {
  const fn = ((key: string) => key) as LocalizerType;
  fn.getIntl = () => mockIntl;
  fn.getLocale = () => 'en';
  fn.getLocaleMessages = () => ({});
  fn.getLocaleDirection = () => 'ltr';
  fn.getHourCyclePreference = () => HourCyclePreference.UnknownPreference;
  fn.trackUsage = () => {};
  fn.stopTrackingUsage = () => [];
  return fn;
})();

describe('StickerButton', function (this: Mocha.Suite) {
  const defaultProps = {
    i18n: mockI18n,
    installedPacks: [] as ReadonlyArray<StickerPackType>,
    receivedPacks: [] as ReadonlyArray<StickerPackType>,
    blessedPacks: [] as ReadonlyArray<StickerPackType>,
    knownPacks: [] as ReadonlyArray<StickerPackType>,
    recentStickers: [] as ReadonlyArray<StickerType>,
    onPickSticker: () => {},
    clearInstalledStickerPack: () => {},
    clearShowIntroduction: () => {},
    clearShowPickerHint: () => {},
    showPickerHint: false,
  };

  let sandbox: sinon.SinonSandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('keyboard shortcuts', function () {
    it('should open sticker picker when Command/Ctrl + Shift + G is pressed', function () {
      const onOpenStateChanged = sandbox.spy();
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      ReactDOM.render(
        <StickerButton
          {...defaultProps}
          onOpenStateChanged={onOpenStateChanged}
        />,
        wrapper
      );

      // Simulate Command/Ctrl + Shift + G
      const event = new KeyboardEvent('keydown', {
        key: 'g',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event);

      assert.isTrue(onOpenStateChanged.calledWith(true));
      document.body.removeChild(wrapper);
    });

    it('should not open sticker picker when panels are open', function () {
      const onOpenStateChanged = sandbox.spy();
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      ReactDOM.render(
        <StickerButton
          {...defaultProps}
          onOpenStateChanged={onOpenStateChanged}
        />,
        wrapper
      );

      // Create a panel element
      const panel = document.createElement('div');
      panel.className = 'conversation panel';
      document.body.appendChild(panel);

      // Simulate Command/Ctrl + Shift + G
      const event = new KeyboardEvent('keydown', {
        key: 'g',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event);

      assert.isFalse(onOpenStateChanged.called);

      // Cleanup
      document.body.removeChild(panel);
      document.body.removeChild(wrapper);
    });

    it('should toggle sticker picker state when shortcut is pressed multiple times', function () {
      const onOpenStateChanged = sandbox.spy();
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      ReactDOM.render(
        <StickerButton
          {...defaultProps}
          onOpenStateChanged={onOpenStateChanged}
        />,
        wrapper
      );

      // First press - should open
      const event1 = new KeyboardEvent('keydown', {
        key: 'g',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event1);
      assert.isTrue(onOpenStateChanged.calledWith(true));

      // Reset spy
      onOpenStateChanged.resetHistory();

      // Second press - should close
      const event2 = new KeyboardEvent('keydown', {
        key: 'g',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event2);
      assert.isTrue(onOpenStateChanged.calledWith(false));

      document.body.removeChild(wrapper);
    });

    it('should not trigger on other keyboard shortcuts', function () {
      const onOpenStateChanged = sandbox.spy();
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      ReactDOM.render(
        <StickerButton
          {...defaultProps}
          onOpenStateChanged={onOpenStateChanged}
        />,
        wrapper
      );

      // Test various other key combinations
      const testEvents = [
        new KeyboardEvent('keydown', { key: 'g', ctrlKey: true }), // Missing shift
        new KeyboardEvent('keydown', { key: 'g', shiftKey: true }), // Missing ctrl
        new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, shiftKey: true }), // Wrong key
        new KeyboardEvent('keydown', { key: 'G', ctrlKey: true }), // Wrong case
      ];

      testEvents.forEach(event => {
        document.dispatchEvent(event);
        assert.isFalse(onOpenStateChanged.called);
      });

      document.body.removeChild(wrapper);
    });
  });
});