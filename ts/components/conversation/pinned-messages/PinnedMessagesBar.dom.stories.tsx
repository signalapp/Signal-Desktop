// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useState } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import type { Pin, PinMessage } from './PinnedMessagesBar.dom.js';
import { PinnedMessagesBar } from './PinnedMessagesBar.dom.js';
import { tw } from '../../../axo/tw.dom.js';
import type { PinnedMessageId } from '../../../types/PinnedMessage.std.js';
import { BodyRange } from '../../../types/BodyRange.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/PinnedMessages/PinnedMessagesBar',
} satisfies Meta;

const PIN_1: Pin = {
  id: 1 as PinnedMessageId,
  sender: {
    id: 'conversation-1',
    title: 'Jamie',
    isMe: true,
  },
  message: {
    id: 'message-1',
    poll: {
      question: 'What should we get for lunch?',
    },
  },
};

const PIN_2: Pin = {
  id: 2 as PinnedMessageId,
  sender: {
    id: 'conversation-2',
    title: 'Tyler',
    isMe: false,
  },
  message: {
    id: 'message-2',
    text: {
      body: 'We found a cute pottery store close to Inokashira Park that we’re going to check out on Saturday. Anyone want to meet at the south exit at Kichijoji station at 1pm? Too early?',
      bodyRanges: [
        { start: 11, length: 4, style: BodyRange.Style.ITALIC },
        { start: 39, length: 15, style: BodyRange.Style.SPOILER },
      ],
    },
  },
};

const PIN_3: Pin = {
  id: 3 as PinnedMessageId,
  sender: {
    id: 'conversation-3',
    title: 'Adrian',
    isMe: false,
  },
  message: {
    id: 'message-3',
    text: {
      body: 'Photo',
      bodyRanges: [],
    },
    attachment: {
      type: 'photo',
      url: '/fixtures/tina-rolf-269345-unsplash.jpg',
    },
  },
};

function Template(props: {
  defaultCurrent: PinnedMessageId;
  pins: ReadonlyArray<Pin>;
}) {
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

function Stack(props: { children: ReactNode }) {
  return (
    <div className={tw('flex max-w-4xl flex-col gap-4 bg-fill-inverted p-4')}>
      {props.children}
    </div>
  );
}

export function Default(): JSX.Element {
  return (
    <Stack>
      <Template defaultCurrent={PIN_1.id} pins={[PIN_1]} />
      <Template defaultCurrent={PIN_2.id} pins={[PIN_1, PIN_2]} />
      <Template defaultCurrent={PIN_3.id} pins={[PIN_1, PIN_2, PIN_3]} />
    </Stack>
  );
}

function Variant(props: { title: string; message: Omit<PinMessage, 'id'> }) {
  const pin: Pin = {
    id: 1 as PinnedMessageId,
    sender: {
      id: 'conversation-1',
      title: props.title,
      isMe: true,
    },
    message: {
      id: 'message-1',
      ...props.message,
    },
  };
  return <Template defaultCurrent={pin.id} pins={[pin]} />;
}

const SHORT_TEXT = 'Lorem, ipsum dolor sit amet';
const IMAGE_URL = '/fixtures/tina-rolf-269345-unsplash.jpg';

export function Variants(): JSX.Element {
  return (
    <Stack>
      <Variant
        title="Plain text"
        message={{ text: { body: SHORT_TEXT, bodyRanges: [] } }}
      />
      <Variant
        title="Photo attachment with text"
        message={{
          text: { body: SHORT_TEXT, bodyRanges: [] },
          attachment: { type: 'photo', url: IMAGE_URL },
        }}
      />
      <Variant
        title="Photo attachment"
        message={{ attachment: { type: 'photo', url: IMAGE_URL } }}
      />
      <Variant
        title="Video attachment with text"
        message={{
          text: { body: SHORT_TEXT, bodyRanges: [] },
          attachment: { type: 'video', url: IMAGE_URL },
        }}
      />
      <Variant
        title="Video attachment"
        message={{ attachment: { type: 'video', url: IMAGE_URL } }}
      />
      <Variant
        title="Voice message"
        message={{ attachment: { type: 'voiceMessage' } }}
      />
      <Variant
        title="GIF message"
        message={{ attachment: { type: 'gif', url: IMAGE_URL } }}
      />
      <Variant
        title="File"
        message={{ attachment: { type: 'file', name: 'project.zip' } }}
      />
      <Variant
        title="Poll"
        message={{ poll: { question: `${SHORT_TEXT}?` } }}
      />
      <Variant title="Sticker" message={{ sticker: true }} />
      <Variant title="Contact" message={{ contact: { name: 'Tyler' } }} />
      <Variant
        title="Address"
        message={{ contact: { address: '742 Evergreen Terrace' } }}
      />
      <Variant title="Payment" message={{ payment: true }} />
    </Stack>
  );
}
