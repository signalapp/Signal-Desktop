// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoIconButton } from './AxoIconButton.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import {
  expectNoAxeViolations,
  getTabSequence,
} from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoIconButton.dom.stories.tsx';

const tooltip = page.getByRole('tooltip');
// Tooltips that repeat the button's label are hidden from the accessibility tree
const presentationalTooltip = page.getByRole('tooltip', {
  includeHidden: true,
});

describe('AxoIconButton', () => {
  testStoriesWithAxe(stories);

  test('disabled buttons stay focusable but do not call onClick', async () => {
    const onClick = vi.fn<() => void>();
    await renderAxo(
      <AxoIconButton.Root
        label="Close"
        variant="implied-secondary"
        size="md"
        symbol="x"
        disabled
        onClick={onClick}
      />
    );

    await expect(getTabSequence()).resolves.toStrictEqual(['button "Close"']);
    const button = page.getByRole('button', { name: 'Close' });
    await expect.element(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    await button.click({ force: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  test('pending buttons do not call onClick', async () => {
    const onClick = vi.fn<() => void>();
    const screen = await renderAxo(
      <AxoIconButton.Root
        label="Send"
        variant="strong-primary"
        size="md"
        symbol="send"
        pending
        onClick={onClick}
      />
    );

    await screen
      .getByRole('button', { name: 'Pending' })
      .click({ force: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  describe('tooltip', () => {
    test('shows the label as a tooltip on hover without announcing it twice', async () => {
      const screen = await renderAxo(
        <AxoIconButton.Root
          label="More actions"
          variant="strong-secondary"
          size="md"
          symbol="more"
        />
      );

      const button = screen.getByRole('button', { name: 'More actions' });
      await button.hover();
      await expect
        .element(presentationalTooltip)
        .toHaveTextContent('More actions');
      await expect.element(tooltip).not.toBeInTheDocument();
      await expect.element(button).not.toHaveAttribute('aria-describedby');
      await expectNoAxeViolations();
    });

    test('custom tooltips describe the button', async () => {
      const screen = await renderAxo(
        <AxoIconButton.Root
          label="Mute"
          tooltip={{ label: 'Mute (⌘M)' }}
          variant="implied-secondary"
          size="md"
          symbol="mic"
        />
      );

      const button = screen.getByRole('button', { name: 'Mute' });
      await button.hover();
      await expect.element(tooltip).toHaveTextContent('Mute (⌘M)');
      await expect.element(button).toHaveAccessibleDescription('Mute (⌘M)');
      await expectNoAxeViolations();
    });

    test('tooltip={false} disables the tooltip', async () => {
      const screen = await renderAxo(
        <AxoIconButton.Root
          label="More actions"
          tooltip={false}
          variant="strong-secondary"
          size="md"
          symbol="more"
        />
      );

      await screen.getByRole('button', { name: 'More actions' }).hover();
      // Give the tooltip a chance to (incorrectly) open
      await new Promise(resolve => {
        setTimeout(resolve, 1000);
      });
      await expect.element(tooltip).not.toBeInTheDocument();
    });
  });
});
