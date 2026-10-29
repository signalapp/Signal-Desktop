// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { AxoChatItem } from './AxoChatItem.dom.tsx';
import { AxoContextMenu } from '../AxoContextMenu.dom.tsx';
import { assert } from '../_internal/assert.std.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoChatList.dom.stories.tsx';

describe('AxoChatList', () => {
  testStoriesWithAxe(stories);

  test('chats keep their hover style while the context menu is open', async () => {
    await renderAxo(
      <AxoContextMenu.Root>
        <AxoContextMenu.Trigger>
          <AxoChatItem.Root>
            <AxoChatItem.Content>
              <AxoChatItem.Label>Alice</AxoChatItem.Label>
            </AxoChatItem.Content>
            <AxoChatItem.HiddenTrigger
              label="Alice"
              onClick={vi.fn<() => void>()}
            />
          </AxoChatItem.Root>
        </AxoContextMenu.Trigger>
        <AxoContextMenu.Content>
          <AxoContextMenu.Item onSelect={vi.fn<() => void>()}>
            Mark unread
          </AxoContextMenu.Item>
        </AxoContextMenu.Content>
      </AxoContextMenu.Root>
    );

    const button = page.getByRole('button', { name: 'Alice' });
    const item = page.elementLocator(
      assert(button.element().closest('.axo-chat-item'))
    );
    await button.click({ button: 'right' });
    await expect.element(page.getByRole('menu')).toBeVisible();
    // Styled by `_AxoBaseChatItem.css`
    await expect
      .element(item)
      .toHaveAttribute('data-axo-contextmenu-state', 'open');
  });
});
