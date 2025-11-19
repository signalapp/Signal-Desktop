// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import type { Pin, PinId } from './PinnedMessagesBar.dom.js';
import { PinnedMessagesBar } from './PinnedMessagesBar.dom.js';
import { tw } from '../../../axo/tw.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/PinnedMessages/PinnedMessagesBar',
} satisfies Meta;

const PIN_1: Pin = {
  id: 'pin-1' as PinId,
  sender: {
    id: 'conversation-1',
    title: 'Jamie',
    isMe: true,
  },
  message: {
    id: 'message-1',
    body: 'What should we get for lunch?',
  },
};

const PIN_2: Pin = {
  id: 'pin-2' as PinId,
  sender: {
    id: 'conversation-1',
    title: 'Tyler',
    isMe: false,
  },
  message: {
    id: 'message-2',
    body: 'We found a cute pottery store close to Inokashira Park that we’re going to check out on Saturday. Anyone want to meet at the south exit at Kichijoji station at 1pm? Too early?',
  },
};

const PIN_3: Pin = {
  id: 'pin-3' as PinId,
  sender: {
    id: 'conversation-1',
    title: 'Adrian',
    isMe: false,
  },
  message: {
    id: 'message-3',
    body: 'Photo',
    attachment: {
      url: '/fixtures/tina-rolf-269345-unsplash.jpg',
    },
  },
};

function Template(props: { defaultCurrent: PinId; pins: ReadonlyArray<Pin> }) {
  const [current, setCurrent] = useState(props.defaultCurrent);
  return (
    <PinnedMessagesBar
      i18n={i18n}
      current={current}
      onCurrentChange={setCurrent}
      pins={props.pins}
      onPinGoTo={action('onPinGoTo')}
      onPinRemove={action('onPinRemove')}
      onPinsShowAll={action('onPinsShowAll')}
    />
  );
}

export function Default(): JSX.Element {
  return (
    <div className={tw('flex max-w-4xl flex-col gap-4 bg-fill-inverted p-4')}>
      <Template defaultCurrent={PIN_1.id} pins={[PIN_1]} />
      <Template defaultCurrent={PIN_2.id} pins={[PIN_1, PIN_2]} />
      <Template defaultCurrent={PIN_3.id} pins={[PIN_1, PIN_2, PIN_3]} />
    </div>
  );
}
