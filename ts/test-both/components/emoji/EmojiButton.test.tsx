// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { assert } from 'chai';
import * as sinon from 'sinon';
import type { IntlShape } from 'react-intl';
import { createIntl, createIntlCache } from 'react-intl';

import { EmojiButton } from '../../../components/emoji/EmojiButton';
import type { LocalizerType } from '../../../types/Util';
import { HourCyclePreference } from '../../../types/I18N';
import { EmojiSkinTone } from '../../../components/fun/data/emojis';

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

describe('EmojiButton', function (this: Mocha.Suite) {
  const defaultProps = {
    i18n: mockI18n,
    onPickEmoji: () => {},
    onClose: () => {},
    onOpen: () => {},
    recentEmojis: [],
    emojiSkinToneDefault: EmojiSkinTone.None,
    onEmojiSkinToneDefaultChange: () => {},
  };

  let sandbox: sinon.SinonSandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('keyboard shortcuts', function () {
    it('should open emoji picker when Command/Ctrl + Shift + J is pressed', function () {
      const onOpen = sandbox.spy();
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      ReactDOM.render(
        <EmojiButton
          {...defaultProps}
          onOpen={onOpen}
        />,
        wrapper
      );

      // Simulate Command/Ctrl + Shift + J
      const event = new KeyboardEvent('keydown', {
        key: 'j',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event);

      assert.isTrue(onOpen.called);
      document.body.removeChild(wrapper);
    });

    it('should not open emoji picker when panels are open', function () {
      const onOpen = sandbox.spy();
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      ReactDOM.render(
        <EmojiButton
          {...defaultProps}
          onOpen={onOpen}
        />,
        wrapper
      );

      // Create a panel element
      const panel = document.createElement('div');
      panel.className = 'conversation panel';
      document.body.appendChild(panel);

      // Simulate Command/Ctrl + Shift + J
      const event = new KeyboardEvent('keydown', {
        key: 'j',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event);

      assert.isFalse(onOpen.called);

      // Cleanup
      document.body.removeChild(panel);
      document.body.removeChild(wrapper);
    });

    it('should toggle emoji picker state when shortcut is pressed multiple times', function () {
      const onOpen = sandbox.spy();
      const onClose = sandbox.spy();
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      ReactDOM.render(
        <EmojiButton
          {...defaultProps}
          onOpen={onOpen}
          onClose={onClose}
        />,
        wrapper
      );

      // First press - should open
      const event1 = new KeyboardEvent('keydown', {
        key: 'j',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event1);
      assert.isTrue(onOpen.called);

      // Reset spy
      onOpen.resetHistory();

      // Second press - should close
      const event2 = new KeyboardEvent('keydown', {
        key: 'j',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event2);
      assert.isTrue(onClose.called);

      document.body.removeChild(wrapper);
    });

    it('should not trigger on other keyboard shortcuts', function () {
      const onOpen = sandbox.spy();
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      ReactDOM.render(
        <EmojiButton
          {...defaultProps}
          onOpen={onOpen}
        />,
        wrapper
      );

      // Test various other key combinations
      const testEvents = [
        new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }), // Missing shift
        new KeyboardEvent('keydown', { key: 'j', shiftKey: true }), // Missing ctrl
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true }), // Wrong key
        new KeyboardEvent('keydown', { key: 'J', ctrlKey: true }), // Wrong case
      ];

      testEvents.forEach(event => {
        document.dispatchEvent(event);
        assert.isFalse(onOpen.called);
      });

      document.body.removeChild(wrapper);
    });
  });
}); 