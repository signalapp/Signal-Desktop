// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoDialog } from './AxoDialog.dom.tsx';
import { AxoButton } from '../AxoButton.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { describeFocused } from '../_test-helpers/a11y.dom.tsx';
import { assert } from '../_internal/assert.std.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
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

const IMAGE = '/fixtures/cat-screenshot-3x4.png';
const IMAGE_WIDTH = 400;
const IMAGE_HEIGHT = 300;

/** A dialog sized by an image */
function FitDialog(): ReactNode {
  return (
    <AxoDialog.Root open onOpenChange={vi.fn<() => void>()}>
      <AxoDialog.Content size="fit" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>Scan QR code</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.StaticBody>
          <AxoDialog.Description>Scan the code to link.</AxoDialog.Description>
          <img src={IMAGE} alt="Camera" className={tw('block w-full')} />
        </AxoDialog.StaticBody>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

async function renderFitDialog(
  windowWidth: number,
  windowHeight: number
): Promise<HTMLImageElement> {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  onTestFinished(async () => {
    await page.viewport(viewport.width, viewport.height);
  });
  await page.viewport(windowWidth, windowHeight);

  await renderAxo(<FitDialog />);
  const image = page.getByRole('img', { name: 'Camera' });
  await expect.element(image).toHaveProperty('naturalWidth', IMAGE_WIDTH);
  return image.element() as HTMLImageElement;
}

/** A dialog in the bottom-end corner with a fixed size */
function BottomEndDialog(): ReactNode {
  return (
    <AxoDialog.Root open onOpenChange={vi.fn<() => void>()}>
      <AxoDialog.Content
        size="sm"
        position="bottom-end"
        escape="cancel-is-noop"
      >
        <AxoDialog.Header>
          <AxoDialog.Title>Replies</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.StaticBody>
          <AxoDialog.Description>Replies to your story.</AxoDialog.Description>
          <div className={tw('h-75')} />
        </AxoDialog.StaticBody>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

type BottomEndLayout = Readonly<{
  /** Scrolls when the window is too small */
  host: HTMLElement;
  /** Covered by the overlay */
  layout: HTMLElement;
  content: HTMLElement;
}>;

async function renderBottomEndDialog(
  windowWidth: number,
  windowHeight: number
): Promise<BottomEndLayout> {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  onTestFinished(async () => {
    await page.viewport(viewport.width, viewport.height);
  });
  await page.viewport(windowWidth, windowHeight);

  await renderAxo(<BottomEndDialog />);
  await expect.element(dialog).toBeVisible();
  const content = dialog.element() as HTMLElement;
  const layout = content.offsetParent as HTMLElement;
  const host = assert(layout.parentElement, 'Missing host');
  return { host, layout, content };
}

type Gaps = Readonly<{ end: number; bottom: number }>;

/** Distance from the bottom-end corner of the layout, ignoring transforms */
function getGaps(result: BottomEndLayout): Gaps {
  const { layout, content } = result;
  return {
    end: layout.offsetWidth - (content.offsetLeft + content.offsetWidth),
    bottom: layout.offsetHeight - (content.offsetTop + content.offsetHeight),
  };
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

  test('"fit" size is as wide as its contents when the window has room', async () => {
    const image = await renderFitDialog(1024, 768);

    expect(image.offsetWidth).toBe(IMAGE_WIDTH);
    expect(image.offsetHeight).toBe(IMAGE_HEIGHT);
  });

  test('"fit" size squeezes its contents to fit a narrow window', async () => {
    const windowWidth = 360;
    const image = await renderFitDialog(windowWidth, 768);
    const content = dialog.element() as HTMLElement;

    expect(content.offsetWidth).toBeLessThanOrEqual(windowWidth);
    expect(image.offsetWidth).toBeLessThan(content.offsetWidth);
    expect(image.offsetWidth / image.offsetHeight).toBeCloseTo(
      IMAGE_WIDTH / IMAGE_HEIGHT,
      1
    );
  });

  test('whole dialog scrolls when the window is too short for a static body', async () => {
    const windowHeight = 200;
    const image = await renderFitDialog(300, windowHeight);

    expect(image.getBoundingClientRect().bottom).toBeGreaterThan(windowHeight);
    image.scrollIntoView({ block: 'end' });
    await expect
      .poll(() => image.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(windowHeight);
    expect(image.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
  });

  test('"bottom-end" position is 20px from the corner when the window has room', async () => {
    const result = await renderBottomEndDialog(1024, 768);

    expect(getGaps(result)).toStrictEqual({ end: 20, bottom: 20 });
  });

  test('"bottom-end" position shrinks its gap instead of scrolling when the window is just tall enough', async () => {
    const result = await renderBottomEndDialog(1024, 768);
    const windowHeight = result.content.offsetHeight + 12;
    await page.viewport(1024, windowHeight);
    await expect.poll(() => result.host.clientHeight).toBe(windowHeight);

    expect(result.host.scrollHeight).toBe(result.host.clientHeight);
    expect(getGaps(result).bottom).toBeCloseTo(8, 0);
  });

  test('"bottom-end" position scrolls with the overlay covering the whole dialog when the window is too short', async () => {
    const result = await renderBottomEndDialog(1024, 200);

    expect(result.host.scrollHeight).toBeGreaterThan(result.host.clientHeight);
    expect(result.layout.offsetHeight).toBe(result.host.scrollHeight);
    expect(getGaps(result).bottom).toBe(4);
  });
});
