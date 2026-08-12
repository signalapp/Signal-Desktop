// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoMediaButton } from './AxoMediaButton.dom.tsx';
import { action } from '@storybook/addon-actions';
import { tw } from './tw.dom.tsx';

export default {
  title: 'Axo/AxoMediaButton',
} satisfies Meta;

function Template(props: { disabled?: boolean }) {
  return (
    <div className={tw('flex gap-2')}>
      <AxoMediaButton.Root
        status="undownloaded"
        downloadedBytes="indeterminate"
        totalBytes="indeterminate"
        onClick={action('onClick')}
        {...props}
      />
      <AxoMediaButton.Root
        status="downloading"
        downloadedBytes="indeterminate"
        totalBytes="indeterminate"
        onClick={action('onClick')}
        {...props}
      />
      <AxoMediaButton.Root
        status="downloading"
        downloadedBytes={300}
        totalBytes={1000}
        onClick={action('onClick')}
        {...props}
      />
      <AxoMediaButton.Root
        status="paused"
        downloadedBytes={1000}
        totalBytes={1000}
        onClick={action('onClick')}
        {...props}
      />
      <AxoMediaButton.Root
        status="playing"
        downloadedBytes={1000}
        totalBytes={1000}
        onClick={action('onClick')}
        {...props}
      />
    </div>
  );
}

export function Statuses(): ReactNode {
  return <Template />;
}

export function Disabled(): ReactNode {
  return <Template disabled />;
}
