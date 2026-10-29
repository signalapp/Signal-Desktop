// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AriaClickable } from './AriaClickable.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AriaClickable.dom.stories.tsx';

type TestCardProps = Readonly<{
  disabled?: boolean;
  onOpen?: () => void;
  onDelete?: () => void;
}>;

function TestCard(props: TestCardProps): ReactNode {
  return (
    <AriaClickable.Root asChild>
      <article aria-label="Card">
        <div>
          <h3>Card Title</h3>
          <span id="see-more">See more</span>
          <AriaClickable.HiddenTrigger
            labelledby="see-more"
            disabled={props.disabled}
            onClick={() => props.onOpen?.()}
          />
        </div>
        <AriaClickable.DeadArea className={tw('w-fit p-2')}>
          <div data-testid="dead-area">
            <AriaClickable.SubWidget>
              <AxoButton.Root
                variant="subtle-secondary"
                size="md"
                onClick={props.onDelete}
              >
                Delete
              </AxoButton.Root>
            </AriaClickable.SubWidget>
          </div>
        </AriaClickable.DeadArea>
      </article>
    </AriaClickable.Root>
  );
}

const trigger = page.getByRole('button', { name: 'See more' });
const deleteButton = page.getByRole('button', { name: 'Delete' });
const card = page.getByRole('article', { name: 'Card' });

describe('AriaClickable', () => {
  testStoriesWithAxe(stories);

  test('clicking the card calls the trigger onClick', async () => {
    const onOpen = vi.fn<() => void>();
    await renderAxo(<TestCard onOpen={onOpen} />);
    await card.click({ position: { x: 4, y: 4 } });
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test('clicking a sub-widget or dead area does not click the trigger', async () => {
    const onOpen = vi.fn<() => void>();
    const onDelete = vi.fn<() => void>();
    await renderAxo(<TestCard onOpen={onOpen} onDelete={onDelete} />);

    await deleteButton.click();
    expect(onDelete).toHaveBeenCalledOnce();
    await page.getByTestId('dead-area').click({ position: { x: 1, y: 1 } });
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('disabled triggers do not call onClick', async () => {
    const onOpen = vi.fn<() => void>();
    await renderAxo(<TestCard disabled onOpen={onOpen} />);
    await expect.element(trigger).toHaveAttribute('aria-disabled', 'true');
    await card.click({ position: { x: 4, y: 4 } });
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('exposes hover and keyboard focus on the root', async () => {
    await renderAxo(<TestCard />);
    // Hovering a sub-widget doesn't count as hovering the trigger
    await deleteButton.hover();
    await expect.element(card).not.toHaveAttribute('data-hovered');
    await trigger.hover();
    await expect.element(card).toHaveAttribute('data-hovered');

    await userEvent.tab();
    await expect.element(card).toHaveAttribute('data-focused');
    await userEvent.tab();
    await expect.element(card).not.toHaveAttribute('data-focused');
  });
});
