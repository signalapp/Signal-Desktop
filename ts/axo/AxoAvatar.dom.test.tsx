// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { AxoAvatar } from './AxoAvatar.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoAvatar.dom.stories.tsx';
import { BADGES_FIXTURE } from '../test-helpers/axoStorybookFixtures.std.tsx';

const BADGE = BADGES_FIXTURE.planet;

describe('AxoAvatar', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Clickable badges on small avatars are below the minimum target size
      Actions: ['target-size'],
    },
  });

  describe('Content', () => {
    test('clicks do not bubble up to parents', async () => {
      const onClick = vi.fn<() => void>();
      const onParentClick = vi.fn<() => void>();
      await renderAxo(
        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={onParentClick}>
          <AxoAvatar.Root size={40}>
            <AxoAvatar.Content label="View Jamie's profile" onClick={onClick}>
              <AxoAvatar.Gradient identifierHash={1} />
            </AxoAvatar.Content>
          </AxoAvatar.Root>
        </div>
      );

      await page.getByRole('button', { name: "View Jamie's profile" }).click();
      expect(onClick).toHaveBeenCalledOnce();
      expect(onParentClick).not.toHaveBeenCalled();
    });
  });

  test('falls back to an icon when the image fails to load', async () => {
    const screen = await renderAxo(
      <AxoAvatar.Root size={40}>
        <AxoAvatar.Content label="Jamie">
          <AxoAvatar.Image
            src="/fake-path-should-not-exist.png"
            srcWidth={64}
            srcHeight={64}
            blur={false}
            fallbackIcon="person"
            fallbackColor="A100"
          />
        </AxoAvatar.Content>
      </AxoAvatar.Root>
    );

    await expect.poll(() => screen.container.querySelector('img')).toBeNull();
    await expect
      .element(page.getByRole('img', { name: 'Jamie' }))
      .toBeVisible();
  });

  describe('Badge', () => {
    test('clicking the badge does not click the avatar', async () => {
      const onAvatarClick = vi.fn<() => void>();
      const onBadgeClick = vi.fn<() => void>();
      await renderAxo(
        <AxoAvatar.Root size={48}>
          <AxoAvatar.Content
            label="View Jamie's profile"
            onClick={onAvatarClick}
          >
            <AxoAvatar.Gradient identifierHash={1} />
          </AxoAvatar.Content>
          <AxoAvatar.Badge
            label={BADGE.name}
            svgs={BADGE.svgs}
            onClick={onBadgeClick}
          />
        </AxoAvatar.Root>
      );

      await page.getByRole('button', { name: BADGE.name }).click();
      expect(onBadgeClick).toHaveBeenCalledOnce();
      expect(onAvatarClick).not.toHaveBeenCalled();
    });

    test('is not rendered on small avatars', async () => {
      await renderAxo(
        <AxoAvatar.Root size={24}>
          <AxoAvatar.Content label="Jamie">
            <AxoAvatar.Gradient identifierHash={1} />
          </AxoAvatar.Content>
          <AxoAvatar.Badge
            label={BADGE.name}
            svgs={BADGE.svgs}
            onClick={vi.fn<() => void>()}
          />
        </AxoAvatar.Root>
      );

      await expect
        .element(page.getByRole('img', { name: 'Jamie' }))
        .toBeVisible();
      await expect
        .element(page.getByRole('button', { name: BADGE.name }))
        .not.toBeInTheDocument();
    });
  });
});
