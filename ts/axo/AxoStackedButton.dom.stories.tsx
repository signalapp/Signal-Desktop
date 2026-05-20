// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useTransition, type ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoStackedButton } from './AxoStackedButton.dom.tsx';
import { tw } from './tw.dom.tsx';
import { AxoTooltip } from './AxoTooltip.dom.tsx';

export default {
  title: 'Axo/AxoStackedButton',
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => {
      return (
        <div
          className={tw(
            'flex flex-col items-center gap-4 py-8',
            'text-center type-body-small text-label-secondary'
          )}
        >
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta;

export function Basic(): ReactNode {
  return <AxoStackedButton.Root symbol="info" label="Info" />;
}

export function LongText(): ReactNode {
  return (
    <AxoStackedButton.Root
      symbol="info"
      label="Lorem ipsum dolor sit amet consectetur adipisicing elit"
    />
  );
}

export function Disabled(): ReactNode {
  return <AxoStackedButton.Root symbol="camera" label="Video" disabled />;
}

export function Pending(): ReactNode {
  const [isPending, startTransition] = useTransition();

  const handleClick = useCallback(() => {
    startTransition(async () => {
      await new Promise(resolve => {
        setTimeout(resolve, 3000);
      });
    });
  }, []);

  return (
    <>
      <AxoStackedButton.Root
        symbol="minus-circle"
        label="Remove"
        pending={isPending}
        onClick={handleClick}
      />
      <p>Click to start spinner</p>
    </>
  );
}

export function Tooltip(): ReactNode {
  return (
    <AxoTooltip.Root label="Already in a call" __FORCE_OPEN>
      <AxoStackedButton.Root symbol="phone" label="Audio" discouraged />
    </AxoTooltip.Root>
  );
}

export function Row(): ReactNode {
  return (
    <AxoStackedButton.Row spacing="md">
      <AxoStackedButton.Root symbol="camera" label="Video" />
      <AxoStackedButton.Root symbol="phone" label="Audio" />
      <AxoStackedButton.Root symbol="bell" label="Mute" />
      <AxoStackedButton.Root symbol="search" label="Search" />
    </AxoStackedButton.Row>
  );
}
