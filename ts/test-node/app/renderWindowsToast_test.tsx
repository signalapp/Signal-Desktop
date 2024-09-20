// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { renderWindowsToast } from '../../../app/renderWindowsToast';
import { NotificationType } from '../../services/notifications';

describe('renderWindowsToast', () => {
  it('handles toast with image', () => {
    const xml = renderWindowsToast({
      avatarPath: 'C:/temp/ab/abcd',
      body: 'Hi there!',
      heading: 'Alice',
      conversationId: 'conversation5',
      type: NotificationType.Message,
    });

    const expected =
      '<toast launch="sgnl://show-conversation?conversationId=conversation5" activationType="protocol"><visual><binding template="ToastImageAndText02"><image id="1" src="file:///C:/temp/ab/abcd" hint-crop="circle"></image><text id="1">Alice</text><text id="2">Hi there!</text></binding></visual></toast>';

    assert.strictEqual(xml, expected);
  });

  it('handles toast with no image', () => {
    const xml = renderWindowsToast({
      body: 'Hi there!',
      heading: 'Alice',
      conversationId: 'conversation5',
      type: NotificationType.Message,
    });

    const expected =
      '<toast launch="sgnl://show-conversation?conversationId=conversation5" activationType="protocol"><visual><binding template="ToastText02"><text id="1">Alice</text><text id="2">Hi there!</text></binding></visual></toast>';

    assert.strictEqual(xml, expected);
  });

  it('handles toast with messageId and storyId', () => {
    const xml = renderWindowsToast({
      body: 'Hi there!',
      heading: 'Alice',
      conversationId: 'conversation5',
      messageId: 'message6',
      storyId: 'story7',
      type: NotificationType.Message,
    });

    const expected =
      '<toast launch="sgnl://show-conversation?conversationId=conversation5&amp;messageId=message6&amp;storyId=story7" activationType="protocol"><visual><binding template="ToastText02"><text id="1">Alice</text><text id="2">Hi there!</text></binding></visual></toast>';

    assert.strictEqual(xml, expected);
  });

  it('handles toast with for incoming call', () => {
    const xml = renderWindowsToast({
      body: 'Hi there!',
      heading: 'Alice',
      conversationId: 'conversation5',
      type: NotificationType.IncomingCall,
    });

    const expected =
      '<toast launch="sgnl://show-window" activationType="protocol"><visual><binding template="ToastText02"><text id="1">Alice</text><text id="2">Hi there!</text></binding></visual></toast>';

    assert.strictEqual(xml, expected);
  });

  it('handles toast with for incoming group call', () => {
    const xml = renderWindowsToast({
      body: 'Hi there!',
      heading: 'Alice',
      conversationId: 'conversation5',
      type: NotificationType.IncomingGroupCall,
    });

    const expected =
      '<toast launch="sgnl://start-call-lobby?conversationId=conversation5" activationType="protocol"><visual><binding template="ToastText02"><text id="1">Alice</text><text id="2">Hi there!</text></binding></visual></toast>';

    assert.strictEqual(xml, expected);
  });

  it('handles toast with for presenting screen', () => {
    const xml = renderWindowsToast({
      body: 'Hi there!',
      heading: 'Alice',
      conversationId: 'conversation5',
      type: NotificationType.IsPresenting,
    });

    const expected =
      '<toast launch="sgnl://cancel-presenting" activationType="protocol"><visual><binding template="ToastText02"><text id="1">Alice</text><text id="2">Hi there!</text></binding></visual></toast>';

    assert.strictEqual(xml, expected);
  });
});
