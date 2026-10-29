// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { AxoContactList } from './AxoContactList.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoContactList.dom.stories.tsx';

type TestContactListProps = Readonly<{
  onOpenJamie?: () => void;
  onMessageJamie?: () => void;
}>;

function TestContactList(props: TestContactListProps): ReactNode {
  return (
    <AxoContactList.Root title="Members">
      <AxoContactList.ActionItem
        symbol="plus"
        title="Add members"
        onClick={vi.fn<() => void>()}
      />
      <AxoContactList.Item
        avatar={null}
        title="Jamie"
        value="Admin"
        description="Coffee lover"
        onClick={() => props.onOpenJamie?.()}
        accessory={
          <AxoContactList.ItemAction
            variant="subtle-secondary"
            onClick={() => props.onMessageJamie?.()}
          >
            Message
          </AxoContactList.ItemAction>
        }
      />
      <AxoContactList.Item avatar={null} title="Tyler" />
      <AxoContactList.EmptyStateItem title="No more members" />
    </AxoContactList.Root>
  );
}

describe('AxoContactList', () => {
  testStoriesWithAxe(stories);

  test('accessories are clickable without activating the item', async () => {
    const onOpenJamie = vi.fn<() => void>();
    const onMessageJamie = vi.fn<() => void>();
    const screen = await renderAxo(
      <TestContactList
        onOpenJamie={onOpenJamie}
        onMessageJamie={onMessageJamie}
      />
    );

    await screen.getByRole('button', { name: 'Message' }).click();
    expect(onMessageJamie).toHaveBeenCalledOnce();
    expect(onOpenJamie).not.toHaveBeenCalled();
  });
});
