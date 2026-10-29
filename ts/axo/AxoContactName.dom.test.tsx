// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoContactName } from './AxoContactName.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { expectNoAxeViolations } from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoContactName.dom.stories.tsx';

const emblem = page.getByRole('button', {
  name: 'This person is in your contacts.',
});
// The tooltip repeats the emblem's label, so it's hidden from the
// accessibility tree
const tooltip = page.getByRole('tooltip', { includeHidden: true });

describe('AxoContactName', () => {
  testStoriesWithAxe(stories);

  describe('SystemContactEmblem', () => {
    test('keeps the tooltip open when clicked', async () => {
      await renderAxo(<AxoContactName.SystemContactEmblem />);

      await emblem.click();
      await expect.element(tooltip).toBeVisible();
    });

    test('keeps the tooltip open when activated with the keyboard', async () => {
      await renderAxo(<AxoContactName.SystemContactEmblem />);

      await userEvent.tab();
      await expect.element(tooltip).toBeVisible();
      await userEvent.keyboard('{Enter}');
      await expect.element(tooltip).toBeVisible();
    });

    test('has no axe violations with the tooltip open', async () => {
      await renderAxo(<AxoContactName.SystemContactEmblem />);

      await emblem.hover();
      await expect.element(tooltip).toBeVisible();
      await expectNoAxeViolations();
    });
  });
});
