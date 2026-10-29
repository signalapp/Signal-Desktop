// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { AxoColorSlider } from './AxoColorSlider.dom.tsx';
import { AxoColor } from './AxoColor.std.ts';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoColorSlider.dom.stories.tsx';

describe('AxoColorSlider', () => {
  testStoryScreenshots(stories);

  test('custom track background and thumb color', async () => {
    const screen = await renderAxo(
      <div className={tw('w-64 p-4')}>
        <AxoColorSlider.Root
          channel="hue"
          color={AxoColor.fromHSL({ hue: 240, saturation: 60, lightness: 50 })}
          onColorChange={vi.fn<() => void>()}
          trackBackground="linear-gradient(to right, #f00, #0f0, #00f)"
          thumbColor={AxoColor.parse('#0ff')}
        />
      </div>
    );
    await expect(screen.container).toMatchScreenshot('custom-track');
  });

  test('custom track background lines up with the thumb in RTL', async () => {
    const screen = await renderAxo(
      <div className={tw('w-64 p-4')}>
        <AxoColorSlider.Root
          channel="lightness"
          color={AxoColor.fromHSL({ hue: 0, saturation: 0, lightness: 0 })}
          onColorChange={vi.fn<() => void>()}
          trackBackground="linear-gradient(to right, #000, #f00 10%, #fff)"
          thumbColor={AxoColor.parse('#000')}
        />
      </div>,
      { direction: 'rtl' }
    );
    await expect(screen.container).toMatchScreenshot('custom-track-rtl');
  });
});
