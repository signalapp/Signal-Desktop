// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { SentTimestampMs } from '@signalapp/types';
import { AxoMessage } from './AxoMessage.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoMessage.dom.stories.tsx';

type TestMessageProps = Readonly<{
  body: string;
  children?: ReactNode;
}>;

function TestMessage(props: TestMessageProps): ReactNode {
  return (
    <AxoMessage.Root direction="outgoing">
      <AxoMessage.Bubble collapseAbove={false} collapseBelow={false}>
        <AxoMessage.Text text={{ body: props.body }} />
        <AxoMessage.Meta>
          <AxoMessage.MetaTimestamp
            sentAt={SentTimestampMs.fromNumber(
              Date.parse('2026-01-15T11:55:00Z')
            )}
          >
            5m
          </AxoMessage.MetaTimestamp>
          {props.children}
        </AxoMessage.Meta>
      </AxoMessage.Bubble>
    </AxoMessage.Root>
  );
}

describe('AxoMessage', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Text in outgoing bubbles doesn't have enough contrast
      Basic: ['color-contrast'],
      OutgoingStatus: ['color-contrast'],
      PartiallySent: ['color-contrast'],
    },
  });

  test('meta actions call onClick without propagating', async () => {
    const onRetry = vi.fn<() => void>();
    const onParentClick = vi.fn<() => void>();
    await renderAxo(
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onParentClick}>
        <TestMessage body="See you tomorrow">
          <AxoMessage.MetaAction onClick={onRetry}>Retry</AxoMessage.MetaAction>
        </TestMessage>
      </div>
    );

    await page.getByRole('button', { name: 'Retry' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
