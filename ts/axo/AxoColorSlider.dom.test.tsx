// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoColorSlider } from './AxoColorSlider.dom.tsx';
import { AxoColor } from './AxoColor.std.ts';
import { assert } from './_internal/assert.std.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoColorSlider.dom.stories.tsx';

function TestSliders(
  props: Readonly<{ onColorChange?: (color: AxoColor) => void }>
): ReactNode {
  const [color, setColor] = useState(() => {
    return AxoColor.fromHSL({ hue: 180, saturation: 50, lightness: 50 });
  });
  function handleColorChange(nextColor: AxoColor) {
    setColor(nextColor);
    props.onColorChange?.(nextColor);
  }
  return (
    <>
      <AxoColorSlider.Root
        channel="hue"
        color={color}
        onColorChange={handleColorChange}
      />
      <AxoColorSlider.Root
        channel="lightness"
        color={color}
        onColorChange={handleColorChange}
      />
    </>
  );
}

describe('AxoColorSlider', () => {
  testStoriesWithAxe(stories);

  test('changes only its own channel', async () => {
    const onColorChange = vi.fn<(color: AxoColor) => void>();
    await renderAxo(<TestSliders onColorChange={onColorChange} />);

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    expect(onColorChange.mock.lastCall?.[0].hsl()).toStrictEqual({
      hue: 180,
      saturation: 50,
      lightness: 100,
    });
  });

  test('is mirrored in RTL', async () => {
    const screen = await renderAxo(<TestSliders />, { direction: 'rtl' });
    const lightness = screen.getByRole('slider', { name: 'Lightness' });

    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(lightness).toHaveValue('51');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(lightness).toHaveValue('49');

    await userEvent.keyboard('{End}');
    await expect.element(lightness).toHaveValue('100');
    const thumb = assert(lightness.element().parentElement);
    const track = assert(thumb.parentElement);
    const thumbRect = thumb.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    // At 100% the thumb should be centered on the left edge of the track
    expect(thumbRect.left + thumbRect.width / 2).toBeCloseTo(trackRect.left, 0);
  });
});
