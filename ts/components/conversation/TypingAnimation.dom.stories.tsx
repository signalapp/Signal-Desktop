// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './TypingAnimation.dom.js';
import { TypingAnimation } from './TypingAnimation.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/TypingAnimation',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  color: overrideProps.color || '',
});

export function Default(): JSX.Element {
  const props = createProps();

  return <TypingAnimation {...props} />;
}

export function Light(): JSX.Element {
  const props = createProps({
    color: 'light',
  });

  return (
    <div style={{ padding: '2em', backgroundColor: 'grey' }}>
      <TypingAnimation {...props} />
    </div>
  );
}
