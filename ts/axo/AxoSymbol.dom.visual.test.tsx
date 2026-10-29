// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { emulateMedia } from './_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoSymbol.dom.stories.tsx';

const SAMPLE_SYMBOLS: ReadonlyArray<AxoSymbol.Name> = [
  'check',
  'arrow-[end]',
  'chevron-[start]',
  'person-circle',
  'lock-fill',
];

function Sample() {
  return (
    <div className={tw('flex flex-col gap-2 p-4 text-primary')}>
      {AxoSymbol.getAllIconSizes().map(size => {
        return (
          <div key={size} className={tw('flex items-center gap-2')}>
            {SAMPLE_SYMBOLS.map(symbol => {
              return (
                <AxoSymbol.Icon
                  key={symbol}
                  size={size}
                  symbol={symbol}
                  label={null}
                />
              );
            })}
          </div>
        );
      })}
      <p className={tw('type-body-medium')}>
        Inline <AxoSymbol.InlineGlyph symbol="arrow-[end]" label={null} /> glyph
      </p>
    </div>
  );
}

describe('AxoSymbol', () => {
  testStoryScreenshots(stories, {
    skip: {
      All: 'Renders every symbol (~800), too large for a stable screenshot',
    },
  });

  test('sample', async () => {
    const screen = await renderAxo(<Sample />);
    await expect(screen.container).toMatchScreenshot('sample-light');
  });

  test('sample (rtl)', async () => {
    const screen = await renderAxo(<Sample />, { direction: 'rtl' });
    await expect(screen.container).toMatchScreenshot('sample-rtl');
  });

  test('sample (forced-colors)', async () => {
    await emulateMedia({ forcedColors: 'active' });
    const screen = await renderAxo(<Sample />);
    await expect(screen.container).toMatchScreenshot('sample-forced-colors');
  });
});
