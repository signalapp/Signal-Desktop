// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoAvatar } from './AxoAvatar.dom.tsx';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoAvatar.dom.stories.tsx';
import { BADGES_FIXTURE } from '../test-helpers/axoStorybookFixtures.std.tsx';

function FocusTest() {
  return (
    <div className={tw('p-4')}>
      <AxoAvatar.Root size={48}>
        <AxoAvatar.Content
          label="View Jamie's profile"
          onClick={vi.fn<() => void>()}
        >
          <AxoAvatar.Initials initials="JK" color="A100" />
        </AxoAvatar.Content>
        <AxoAvatar.Badge
          label={BADGES_FIXTURE.planet.name}
          svgs={BADGES_FIXTURE.planet.svgs}
          onClick={vi.fn<() => void>()}
        />
      </AxoAvatar.Root>
    </div>
  );
}

describe('AxoAvatar', () => {
  testStoryScreenshots(stories);

  test('focus ring is visible', async () => {
    const screen = await renderAxo(<FocusTest />);
    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot('focus-ring-avatar');
    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot('focus-ring-badge');
  });
});
