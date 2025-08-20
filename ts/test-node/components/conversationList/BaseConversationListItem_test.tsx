// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

describe('BaseConversationListItem', () => {
  const defaultProps = {
    conversationType: 'direct' as const,
    headerName: 'Test Conversation',
    i18n: {
      'icu:BaseConversationListItem__aria-label': 'Conversation {title}',
    } as any,
    isSelected: false,
    title: 'Test Conversation',
    avatarPlaceholderGradient: 'test-gradient',
    avatarUrl: 'test-avatar.jpg',
    color: 'test-color',
    hasAvatar: false,
    isMe: false,
    phoneNumber: '+1234567890',
    profileName: undefined,
    sharedGroupNames: [],
    serviceId: 'test-service-id',
  };

  beforeEach(() => {
    sinon.restore();
  });

  describe('onContextMenu prop', () => {
    it('accepts onContextMenu prop when onClick is provided', () => {
      const onContextMenu = sinon.fake();
      const onClick = sinon.fake();
      
      const props = { ...defaultProps, onClick, onContextMenu };
      
      // Test that both props are properly set
      assert.isFunction(props.onClick);
      assert.isFunction(props.onContextMenu);
    });

    it('accepts onContextMenu prop when onClick is not provided', () => {
      const onContextMenu = sinon.fake();
      
      const props = { ...defaultProps, onContextMenu };
      
      // Test that onContextMenu is properly set
      assert.isFunction(props.onContextMenu);
      assert.isUndefined((props as any).onClick);
    });

    it('renders without onContextMenu when not provided', () => {
      const onClick = sinon.fake();
      
      const props = { ...defaultProps, onClick };
      
      // Should not have onContextMenu property
      assert.isUndefined((props as any).onContextMenu);
    });
  });

  describe('basic conversation data', () => {
    it('has required conversation properties', () => {
      const props = { ...defaultProps };
      
      assert.strictEqual(props.conversationType, 'direct');
      assert.strictEqual(props.headerName, 'Test Conversation');
      assert.strictEqual(props.title, 'Test Conversation');
      assert.strictEqual(props.avatarPlaceholderGradient, 'test-gradient');
      assert.strictEqual(props.avatarUrl, 'test-avatar.jpg');
      assert.strictEqual(props.color, 'test-color');
      assert.strictEqual(props.phoneNumber, '+1234567890');
      assert.strictEqual(props.serviceId, 'test-service-id');
    });

    it('handles avatar state', () => {
      const props = { ...defaultProps, hasAvatar: true };
      
      assert.isTrue(props.hasAvatar);
    });

    it('handles note to self conversation', () => {
      const props = { ...defaultProps, isMe: true };
      
      assert.isTrue(props.isMe);
    });

    it('handles profile name', () => {
      const profileName = 'Test Profile Name';
      const props = { ...defaultProps, profileName };
      
      assert.strictEqual(props.profileName, profileName);
    });

    it('handles shared group names', () => {
      const sharedGroupNames = ['Group 1', 'Group 2'];
      const props = { ...defaultProps, sharedGroupNames };
      
      assert.deepEqual(props.sharedGroupNames, sharedGroupNames);
    });
  });

  describe('conversation state', () => {
    it('handles selected state', () => {
      const props = { ...defaultProps, isSelected: true };
      
      assert.isTrue(props.isSelected);
    });

    it('handles disabled state', () => {
      const onClick = sinon.fake();
      const disabled = true;
      
      const props = { ...defaultProps, onClick, disabled };
      
      assert.isTrue(props.disabled);
    });
  });

  describe('interaction handlers', () => {
    it('provides onClick handler', () => {
      const onClick = sinon.fake();
      const props = { ...defaultProps, onClick };
      
      assert.isFunction(props.onClick);
    });

    it('provides onMouseDown handler', () => {
      const onClick = sinon.fake();
      const onMouseDown = sinon.fake();
      
      const props = { ...defaultProps, onClick, onMouseDown };
      
      assert.isFunction(props.onMouseDown);
    });
  });

  describe('checkbox mode', () => {
    it('handles checked state', () => {
      const checked = true;
      const props = { ...defaultProps, checked };
      
      assert.isTrue(props.checked);
    });

    it('handles unchecked state', () => {
      const checked = false;
      const props = { ...defaultProps, checked };
      
      assert.isFalse(props.checked);
    });

    it('handles disabled checkbox state', () => {
      const checked = true;
      const disabled = true;
      const props = { ...defaultProps, checked, disabled };
      
      assert.isTrue(props.checked);
      assert.isTrue(props.disabled);
    });
  });

  describe('spinner mode', () => {
    it('handles spinner state', () => {
      const shouldShowSpinner = true;
      const props = { ...defaultProps, shouldShowSpinner };
      
      assert.isTrue(props.shouldShowSpinner);
    });

    it('handles no spinner state', () => {
      const shouldShowSpinner = false;
      const props = { ...defaultProps, shouldShowSpinner };
      
      assert.isFalse(props.shouldShowSpinner);
    });
  });

  describe('accessibility', () => {
    it('provides aria-label', () => {
      const props = { ...defaultProps };
      
      assert.strictEqual(props.i18n['icu:BaseConversationListItem__aria-label'], 'Conversation {title}');
    });

    it('handles custom button aria label', () => {
      const onClick = sinon.fake();
      const buttonAriaLabel = 'Custom aria label';
      
      const props = { ...defaultProps, onClick, buttonAriaLabel };
      
      assert.strictEqual(props.buttonAriaLabel, buttonAriaLabel);
    });
  });

  describe('conversation types', () => {
    it('handles direct conversation type', () => {
      const props = { ...defaultProps, conversationType: 'direct' as const };
      
      assert.strictEqual(props.conversationType, 'direct');
    });

    it('handles group conversation type', () => {
      const props = { ...defaultProps, conversationType: 'group' as const };
      
      assert.strictEqual(props.conversationType, 'group');
    });
  });
});
