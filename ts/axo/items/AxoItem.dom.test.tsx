// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoItem } from './AxoItem.dom.tsx';
import { AxoClickableItem } from './AxoClickableItem.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoItem.dom.stories.tsx';

type TestItemsProps = Readonly<{
  onOpenNotifications?: () => void;
  onOpenPrivacy?: () => void;
}>;

function TestItems(props: TestItemsProps): ReactNode {
  return (
    <AxoItem.Group>
      <AxoItem.Root>
        <AxoItem.Content>
          <AxoItem.Label>Notifications</AxoItem.Label>
          <AxoItem.Value>On</AxoItem.Value>
          <AxoItem.Description>Sounds and badges</AxoItem.Description>
          <AxoItem.HiddenTrigger
            label="Open notifications"
            onClick={() => props.onOpenNotifications?.()}
          />
        </AxoItem.Content>
      </AxoItem.Root>
      <AxoItem.Root disabled>
        <AxoItem.Content>
          <AxoItem.Label>Privacy</AxoItem.Label>
          <AxoItem.HiddenTrigger
            label="Open privacy"
            onClick={() => props.onOpenPrivacy?.()}
          />
        </AxoItem.Content>
      </AxoItem.Root>
    </AxoItem.Group>
  );
}

describe('AxoItem', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Destructive labels don't have enough contrast in light mode
      Destructive: ['color-contrast'],
      // TODO: axe doesn't treat disabled item text as exempt, because it
      // isn't inside of the `aria-disabled` trigger
      Disabled: ['color-contrast'],
    },
  });

  test('matches aria snapshot', async () => {
    const screen = await renderAxo(<TestItems />);
    await expect.element(screen.getByRole('list')).toMatchAriaInlineSnapshot(`
      - list:
        - listitem "Notifications On":
          - text: Notifications On Sounds and badges
          - button "Open notifications"
        - listitem "Privacy":
          - text: Privacy
          - button "Open privacy" [disabled]
    `);
  });

  test('clicking anywhere on the item calls onClick', async () => {
    const onOpenNotifications = vi.fn<() => void>();
    const screen = await renderAxo(
      <TestItems onOpenNotifications={onOpenNotifications} />
    );
    await screen.getByRole('listitem', { name: 'Notifications On' }).click();
    expect(onOpenNotifications).toHaveBeenCalledOnce();
  });

  test('disabled items stay focusable but do not call onClick', async () => {
    const onOpenPrivacy = vi.fn<() => void>();
    const screen = await renderAxo(<TestItems onOpenPrivacy={onOpenPrivacy} />);
    const trigger = screen.getByRole('button', { name: 'Open privacy' });

    await expect.element(trigger).toHaveAttribute('aria-disabled', 'true');
    await trigger.click({ force: true });
    trigger.element().focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpenPrivacy).not.toHaveBeenCalled();
  });
});

describe('AxoClickableItem', () => {
  test('trigger keeps the tooltip description', async () => {
    const screen = await renderAxo(
      <AxoItem.Group>
        <AxoClickableItem.Root
          label="Chats"
          description="Manage chat history"
          tooltip="Opens settings"
          onClick={vi.fn<() => void>()}
        />
      </AxoItem.Group>
    );
    await userEvent.tab();
    await expect
      .element(screen.getByRole('button', { name: 'Chats' }))
      .toHaveAccessibleDescription('Manage chat history Opens settings');
  });
});
