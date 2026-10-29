// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createPortal } from 'react-dom';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { AxoTheme } from './AxoTheme.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoTheme.dom.stories.tsx';

function getColorScheme(testId: string): string {
  return getComputedStyle(page.getByTestId(testId).element()).colorScheme;
}

describe('AxoTheme', () => {
  testStoriesWithAxe(stories);

  test('forces a color scheme on its subtree', async () => {
    await renderAxo(
      <>
        <AxoTheme.Override theme="force-light">
          <div data-testid="force-light" />
        </AxoTheme.Override>
        <AxoTheme.Override theme="force-dark">
          <div data-testid="force-dark" />
        </AxoTheme.Override>
      </>,
      { theme: 'dark' }
    );

    expect(getColorScheme('force-light')).toBe('light');
    expect(getColorScheme('force-dark')).toBe('dark');
  });

  describe('"auto" follows the app theme', () => {
    async function check(theme: 'light' | 'dark') {
      await renderAxo(
        <AxoTheme.Override theme="force-dark">
          <AxoTheme.Override theme="auto">
            <div data-testid="auto" />
          </AxoTheme.Override>
        </AxoTheme.Override>,
        { theme }
      );

      expect(getColorScheme('auto')).toBe(theme);
    }

    test('light', () => check('light'));

    test('dark', () => check('dark'));
  });

  test('<AxoTheme.Inherit> re-applies the color scheme inside portals', async () => {
    await renderAxo(
      <AxoTheme.Override theme="force-dark">
        {createPortal(
          <AxoTheme.Inherit>
            <div data-testid="portalled" />
          </AxoTheme.Inherit>,
          document.body
        )}
      </AxoTheme.Override>
    );

    expect(getColorScheme('portalled')).toBe('dark');
  });

  test('<AxoTheme.Inherit> defaults to "auto" without an <AxoTheme.Override>', async () => {
    await renderAxo(
      <AxoTheme.Inherit>
        <div data-testid="inherit" />
      </AxoTheme.Inherit>,
      { theme: 'dark' }
    );

    expect(getColorScheme('inherit')).toBe('dark');
  });
});
