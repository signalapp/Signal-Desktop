// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoAlertDialog } from './AxoAlertDialog.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { describeFocused } from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoAlertDialog.dom.stories.tsx';

type TestAlertDialogProps = Readonly<{
  escape?: AxoAlertDialog.ContentEscape;
  onOpenChange?: (open: boolean) => void;
  onCancel?: () => void;
  onDiscard?: (event: MouseEvent<HTMLButtonElement>) => void;
}>;

function TestAlertDialog(props: TestAlertDialogProps): ReactNode {
  return (
    <AxoAlertDialog.Root
      onOpenChange={props.onOpenChange}
      onCancel={props.onCancel}
    >
      <AxoAlertDialog.Trigger>
        <AxoButton.Root variant="strong-destructive" size="md">
          Discard Draft
        </AxoButton.Root>
      </AxoAlertDialog.Trigger>
      <AxoAlertDialog.Content escape={props.escape ?? 'cancel-is-noop'}>
        <AxoAlertDialog.Body>
          <AxoAlertDialog.Title>Discard draft?</AxoAlertDialog.Title>
          <AxoAlertDialog.Description>
            Your message will be deleted.
          </AxoAlertDialog.Description>
        </AxoAlertDialog.Body>
        <AxoAlertDialog.Footer>
          <AxoAlertDialog.Cancel />
          <AxoAlertDialog.Action
            variant="strong-primary"
            onClick={event => props.onDiscard?.(event)}
          >
            Discard
          </AxoAlertDialog.Action>
        </AxoAlertDialog.Footer>
      </AxoAlertDialog.Content>
    </AxoAlertDialog.Root>
  );
}

/** A dialog without a `Trigger`, opened by some other button */
function ControlledDialog(): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Export Chat
      </button>
      <AxoAlertDialog.Root open={open} onOpenChange={setOpen}>
        <AxoAlertDialog.Content escape="cancel-is-noop">
          <AxoAlertDialog.Body>
            <AxoAlertDialog.Title>Exporting chat</AxoAlertDialog.Title>
            <AxoAlertDialog.Description>
              Your chat will be downloaded.
            </AxoAlertDialog.Description>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Action variant="strong-primary" autoFocus>
              Show Download
            </AxoAlertDialog.Action>
          </AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
    </>
  );
}

const dialog = page.getByRole('alertdialog');
// The rest of the page is hidden from the accessibility tree while open
const trigger = page.getByRole('button', {
  name: 'Discard Draft',
  includeHidden: true,
});
const opener = page.getByRole('button', {
  name: 'Export Chat',
  includeHidden: true,
});

describe('AxoAlertDialog', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Scrollable `Body` has no `tabindex`, see AxoScrollArea
      ExtraLongText: ['scrollable-region-focusable'],
    },
  });

  describe('onCancel', () => {
    test('is not called when an action closes the dialog', async () => {
      const onDiscard = vi.fn<() => void>();
      const onCancel = vi.fn<() => void>();
      const onOpenChange = vi.fn<(open: boolean) => void>();
      await renderAxo(
        <TestAlertDialog
          onDiscard={onDiscard}
          onCancel={onCancel}
          onOpenChange={onOpenChange}
        />
      );

      await trigger.click();
      await dialog.getByRole('button', { name: 'Discard' }).click();
      await expect.element(dialog).not.toBeInTheDocument();
      expect(onDiscard).toHaveBeenCalledOnce();
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
      expect(onCancel).not.toHaveBeenCalled();
    });

    test('is called when canceling after an action prevented closing', async () => {
      const onCancel = vi.fn<() => void>();
      await renderAxo(
        <TestAlertDialog
          onCancel={onCancel}
          onDiscard={event => event.preventDefault()}
        />
      );

      await trigger.click();
      await dialog.getByRole('button', { name: 'Discard' }).click();
      await expect.element(dialog).toBeVisible();
      expect(onCancel).not.toHaveBeenCalled();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect.element(dialog).not.toBeInTheDocument();
      expect(onCancel).toHaveBeenCalledOnce();
    });

    test('is called by Escape', async () => {
      const onCancel = vi.fn<() => void>();
      await renderAxo(<TestAlertDialog onCancel={onCancel} />);

      await trigger.click();
      await expect.element(dialog).toBeVisible();
      await userEvent.keyboard('{Escape}');
      await expect.element(dialog).not.toBeInTheDocument();
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  test('pressing Escape does nothing if cancel is destructive', async () => {
    const onCancel = vi.fn<() => void>();
    await renderAxo(
      <TestAlertDialog escape="cancel-is-destructive" onCancel={onCancel} />
    );

    await trigger.click();
    await expect.element(dialog).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).toBeVisible();
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('restores focus without a trigger when an action has autoFocus', async () => {
    await renderAxo(<ControlledDialog />);

    await opener.click();
    await expect.poll(describeFocused).toBe('button "Show Download"');
    await userEvent.keyboard('{Enter}');
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
  });
});
