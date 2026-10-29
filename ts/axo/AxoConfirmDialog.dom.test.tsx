// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoConfirmDialog } from './AxoConfirmDialog.dom.tsx';
import type { AxoAlertDialog } from './AxoAlertDialog.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoConfirmDialog.dom.stories.tsx';

type TestConfirmDialogProps = Readonly<{
  escape?: AxoAlertDialog.ContentEscape;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
}>;

function TestConfirmDialog(props: TestConfirmDialogProps): ReactNode {
  return (
    <AxoConfirmDialog.Root
      open
      escape={props.escape}
      onOpenChange={props.onOpenChange}
      onCancel={props.onCancel}
      title="Save changes?"
      description="Your changes to this chat folder will be saved."
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Ok />
    </AxoConfirmDialog.Root>
  );
}

const dialog = page.getByRole('alertdialog');

describe('AxoConfirmDialog', () => {
  testStoriesWithAxe(stories);

  test('pressing Escape does nothing by default', async () => {
    const onCancel = vi.fn<() => void>();
    const onOpenChange = vi.fn<(open: boolean) => void>();
    await renderAxo(
      <TestConfirmDialog onCancel={onCancel} onOpenChange={onOpenChange} />
    );

    await expect.element(dialog).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test('pressing Escape cancels if cancel is a noop', async () => {
    const onCancel = vi.fn<() => void>();
    const onOpenChange = vi.fn<(open: boolean) => void>();
    await renderAxo(
      <TestConfirmDialog
        escape="cancel-is-noop"
        onCancel={onCancel}
        onOpenChange={onOpenChange}
      />
    );

    await expect.element(dialog).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
});
