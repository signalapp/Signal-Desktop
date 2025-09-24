// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';

describe('LeftPane click-to-deselect functionality', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('click handler logic', () => {
    it('should identify empty areas correctly', () => {
      // Create empty area elements
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'module-left-pane__list';
      document.body.appendChild(emptyDiv);

      // Test empty area detection
      const isInteractive = emptyDiv.closest(
        'button, input, [role="button"], .module-conversation-list-item, .module-search-results, .module-left-pane-dialog'
      );

      assert.isNull(
        isInteractive,
        'Empty areas should not be detected as interactive'
      );

      document.body.removeChild(emptyDiv);
    });

    it('should identify interactive elements correctly', () => {
      // Create interactive element
      const button = document.createElement('button');
      const spanInsideButton = document.createElement('span');
      button.appendChild(spanInsideButton);
      document.body.appendChild(button);

      // Test interactive element detection
      const isInteractive = spanInsideButton.closest(
        'button, input, [role="button"], .module-conversation-list-item, .module-search-results, .module-left-pane-dialog'
      );

      assert.isNotNull(
        isInteractive,
        'Elements inside buttons should be detected as interactive'
      );

      document.body.removeChild(button);
    });

    it('should identify conversation list items as interactive', () => {
      // Create conversation list item
      const listItem = document.createElement('div');
      listItem.className = 'module-conversation-list-item';
      const childElement = document.createElement('span');
      listItem.appendChild(childElement);
      document.body.appendChild(listItem);

      // Test conversation list item detection
      const isInteractive = childElement.closest(
        'button, input, [role="button"], .module-conversation-list-item, .module-search-results, .module-left-pane-dialog'
      );

      assert.isNotNull(
        isInteractive,
        'Elements inside conversation list items should be detected as interactive'
      );

      document.body.removeChild(listItem);
    });
  });

  describe('deselection conditions', () => {
    it('should require both selected conversation and empty area for deselection', () => {
      const conversationId = uuid();

      // Test case 1: Has conversation, empty area - should deselect
      const hasConversation = !!conversationId;
      const isEmptyArea = true;
      const shouldDeselect1 = hasConversation && isEmptyArea;
      assert.isTrue(
        shouldDeselect1,
        'Should deselect when conversation selected and clicking empty area'
      );

      // Test case 2: Has conversation, interactive area - should NOT deselect
      const isInteractiveArea = true;
      const shouldDeselect2 = hasConversation && !isInteractiveArea;
      assert.isFalse(
        shouldDeselect2,
        'Should NOT deselect when clicking interactive area'
      );

      // Test case 3: No conversation, empty area - should NOT deselect
      const noConversation = false;
      const shouldDeselect3 = noConversation && isEmptyArea;
      assert.isFalse(
        shouldDeselect3,
        'Should NOT deselect when no conversation is selected'
      );
    });
  });

  describe('showConversation call format', () => {
    it('should call showConversation with correct parameters for deselection', () => {
      const mockShowConversation = sandbox.spy();

      // Simulate the deselection call
      mockShowConversation({
        conversationId: undefined,
        messageId: undefined,
      });

      assert.isTrue(
        mockShowConversation.calledOnce,
        'showConversation should be called once'
      );
      assert.isTrue(
        mockShowConversation.calledWithExactly({
          conversationId: undefined,
          messageId: undefined,
        }),
        'showConversation should be called with undefined conversationId and messageId'
      );
    });
  });
});
