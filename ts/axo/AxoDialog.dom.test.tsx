// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoDialog } from './AxoDialog.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { describeFocused } from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoDialog.dom.stories.tsx';

type TestDialogProps = Readonly<{
  escape?: AxoDialog.ContentEscape;
  onOpenChange?: (open: boolean) => void;
}>;

function TestDialog(props: TestDialogProps): ReactNode {
  return (
    <AxoDialog.Root onOpenChange={props.onOpenChange}>
      <AxoDialog.Trigger asChild>
        <AxoButton.Root variant="strong-primary" size="md">
          Open Settings
        </AxoButton.Root>
      </AxoDialog.Trigger>
      <AxoDialog.Content size="md" escape={props.escape ?? 'cancel-is-noop'}>
        <AxoDialog.Header>
          <AxoDialog.Back onClick={vi.fn<() => void>()} />
          <AxoDialog.Title>Settings</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            Choose your preferences.
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="subtle-secondary"
              onClick={vi.fn<() => void>()}
            >
              Cancel
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              onClick={vi.fn<() => void>()}
            >
              Save
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

type ControlledDialogProps = Readonly<{
  autoFocusSave?: boolean;
}>;

/** A dialog without a `Trigger`, opened by some other button */
function ControlledDialog(props: ControlledDialogProps): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Edit Nickname
      </button>
      <AxoDialog.Root open={open} onOpenChange={setOpen}>
        <AxoDialog.Content size="sm" escape="cancel-is-noop">
          <AxoDialog.Header>
            <AxoDialog.Title>Nickname</AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body>
            <AxoDialog.Description>Only visible to you.</AxoDialog.Description>
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              <AxoDialog.Action
                variant="strong-primary"
                autoFocus={props.autoFocusSave}
                onClick={() => setOpen(false)}
              >
                Save
              </AxoDialog.Action>
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        </AxoDialog.Content>
      </AxoDialog.Root>
    </>
  );
}

const dialog = page.getByRole('dialog');
// The rest of the page is hidden from the accessibility tree while open
const trigger = page.getByRole('button', {
  name: 'Open Settings',
  includeHidden: true,
});
const opener = page.getByRole('button', {
  name: 'Edit Nickname',
  includeHidden: true,
});

describe('AxoDialog', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Scrollable `Body` has no `tabindex`, see AxoScrollArea
      LongContent: ['scrollable-region-focusable'],
    },
  });

  test('pressing Escape or clicking outside does nothing if cancel is destructive', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    await renderAxo(
      <TestDialog escape="cancel-is-destructive" onOpenChange={onOpenChange} />
    );

    await trigger.click();
    await expect.element(dialog).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await page
      .elementLocator(document.body)
      .click({ position: { x: 5, y: 5 } });
    await expect.element(dialog).toBeVisible();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test('restores focus to the previously focused element without a trigger', async () => {
    await renderAxo(<ControlledDialog />);

    await opener.click();
    await expect.poll(describeFocused).toBe('button "Close"');
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
  });

  test('restores focus without a trigger when an action has autoFocus', async () => {
    await renderAxo(<ControlledDialog autoFocusSave />);

    await opener.click();
    await expect.poll(describeFocused).toBe('button "Save"');
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
  });
});
