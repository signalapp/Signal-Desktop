// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoTooltip } from './AxoTooltip.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { expectNoAxeViolations } from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoTooltip.dom.stories.tsx';

type TestTooltipProps = Readonly<{
  label?: string;
  disabled?: boolean;
  keepOpenOnActivation?: boolean;
  keyboardShortcut?: string;
  tooltipRepeatsTriggerAccessibleName?: boolean;
}>;

function TestTooltip(props: TestTooltipProps): ReactNode {
  return (
    <AxoTooltip.Root
      label={props.label ?? 'Start a voice call'}
      delay="none"
      disabled={props.disabled}
      keepOpenOnActivation={props.keepOpenOnActivation}
      keyboardShortcut={props.keyboardShortcut}
      tooltipRepeatsTriggerAccessibleName={
        props.tooltipRepeatsTriggerAccessibleName
      }
    >
      <AxoButton.Root variant="strong-primary" size="md">
        Call
      </AxoButton.Root>
    </AxoTooltip.Root>
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const tooltip = page.getByRole('tooltip');
// `tooltipRepeatsTriggerAccessibleName` hides tooltips from the accessibility tree
const presentationalTooltip = page.getByRole('tooltip', {
  includeHidden: true,
});
const trigger = page.getByRole('button', { name: 'Call' });

describe('AxoTooltip', () => {
  testStoriesWithAxe(stories);

  describe('interactions', () => {
    test('does not show on programmatic focus', async () => {
      await renderAxo(<TestTooltip />);

      trigger.element().focus();
      await expect.element(trigger).toHaveFocus();
      await wait(100);
      await expect.element(tooltip).not.toBeInTheDocument();
    });

    test('stays open when the trigger is clicked with keepOpenOnActivation', async () => {
      await renderAxo(<TestTooltip keepOpenOnActivation />);

      await trigger.hover();
      await expect.element(tooltip).toBeInTheDocument();
      await trigger.click();
      await expect.element(tooltip).toBeInTheDocument();
    });

    test('does not show when disabled', async () => {
      await renderAxo(<TestTooltip disabled />);

      await trigger.hover();
      await userEvent.tab();
      await expect.element(trigger).toHaveFocus();
      await wait(100);
      await expect.element(tooltip).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    test('includes the keyboard shortcut in the description', async () => {
      await renderAxo(<TestTooltip keyboardShortcut="⌘⇧C" />);

      await trigger.hover();
      await expect
        .element(trigger)
        .toHaveAccessibleDescription('Start a voice call ⌘⇧C');
    });

    test('is not announced when it repeats the trigger name', async () => {
      await renderAxo(
        <TestTooltip label="Call" tooltipRepeatsTriggerAccessibleName />
      );

      await trigger.hover();
      await expect.element(presentationalTooltip).toHaveTextContent('Call');
      await expect.element(tooltip).not.toBeInTheDocument();
      await expect.element(trigger).not.toHaveAttribute('aria-describedby');
      await expectNoAxeViolations();
    });
  });
});
