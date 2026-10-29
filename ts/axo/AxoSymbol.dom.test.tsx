// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoSymbol.dom.stories.tsx';

function getRenderedGlyph(container: HTMLElement): string | null {
  return (
    container
      .querySelector('[data-axo-symbol-glyph]')
      ?.getAttribute('data-axo-symbol-glyph') ?? null
  );
}

describe('AxoSymbol', () => {
  testStoriesWithAxe(stories);

  test('directional symbols are mirrored in RTL', async () => {
    const ltr = await renderAxo(
      <AxoSymbol.Icon size={20} symbol="arrow-[end]" label={null} />
    );
    const ltrGlyph = getRenderedGlyph(ltr.container);
    await ltr.unmount();

    const rtl = await renderAxo(
      <AxoSymbol.Icon size={20} symbol="arrow-[end]" label={null} />,
      { direction: 'rtl' }
    );
    const rtlGlyph = getRenderedGlyph(rtl.container);
    expect(rtlGlyph).not.toBe('');
    expect(rtlGlyph).not.toBe(ltrGlyph);
  });

  test('glyphs are not part of the text content', async () => {
    const screen = await renderAxo(
      <p>
        Next <AxoSymbol.InlineGlyph symbol="arrow-[end]" label={null} />
      </p>
    );
    expect(screen.container.textContent).toBe('Next ');
  });
});
