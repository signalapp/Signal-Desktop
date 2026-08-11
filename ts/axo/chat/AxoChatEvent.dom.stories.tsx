// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AxoChatEvent } from './AxoChatEvent.dom.tsx';
import { AxoTooltip } from '../AxoTooltip.dom.tsx';
import { TimestampMs } from '@signalapp/types';
import type { AxoIntl } from '../_internal/AxoIntl.dom.tsx';

export default {
  title: 'Axo/Chat/AxoChatEvent',
} satisfies Meta;

export function Basic(): ReactNode {
  return (
    <AxoChatEvent.Root>
      <AxoChatEvent.Body variant="secondary" symbol="arrow-clockwise">
        Secure session reset
      </AxoChatEvent.Body>
    </AxoChatEvent.Root>
  );
}

export function InlineAction(): ReactNode {
  const contact = (
    <AxoChatEvent.InlineAction onClick={action('onShowContact')}>
      John
    </AxoChatEvent.InlineAction>
  );

  return (
    <AxoChatEvent.Root>
      <AxoChatEvent.Body variant="secondary" symbol="leave">
        {contact} left the group
      </AxoChatEvent.Body>
    </AxoChatEvent.Root>
  );
}

export function Timestamp(): ReactNode {
  const contact = (
    <AxoChatEvent.InlineAction onClick={action('onShowContact')}>
      John
    </AxoChatEvent.InlineAction>
  );

  return (
    <AxoChatEvent.Root>
      <AxoChatEvent.Body variant="secondary" symbol="phone">
        {contact} changed their phone number
        <AxoChatEvent.Timestamp timestamp={TimestampMs.now()}>
          Now
        </AxoChatEvent.Timestamp>
      </AxoChatEvent.Body>
    </AxoChatEvent.Root>
  );
}

export function Action(): ReactNode {
  const contact = (
    <AxoChatEvent.InlineAction onClick={action('onShowContact')}>
      John
    </AxoChatEvent.InlineAction>
  );

  return (
    <>
      <AxoChatEvent.Root>
        <AxoChatEvent.Body variant="secondary" symbol="pin">
          {contact} pinned a message
        </AxoChatEvent.Body>
        <AxoChatEvent.Action
          variant="subtle-secondary"
          onClick={action('onGoToMessage')}
        >
          Go to message
        </AxoChatEvent.Action>
      </AxoChatEvent.Root>

      <AxoChatEvent.Root>
        <AxoChatEvent.Body variant="secondary" symbol="message-thread">
          {contact} sent you a message
        </AxoChatEvent.Body>
        <AxoChatEvent.Action
          variant="subtle-primary"
          onClick={action('onGoToMessage')}
        >
          Update Signal
        </AxoChatEvent.Action>
      </AxoChatEvent.Root>

      <AxoChatEvent.Root>
        <AxoChatEvent.Body variant="secondary" symbol="camera">
          {contact} started a video call
          <AxoChatEvent.Timestamp timestamp={TimestampMs.now()}>
            8m
          </AxoChatEvent.Timestamp>
        </AxoChatEvent.Body>
        <AxoChatEvent.Action
          variant="subtle-affirmative"
          onClick={action('onGoToMessage')}
        >
          Join call
        </AxoChatEvent.Action>
      </AxoChatEvent.Root>

      <AxoChatEvent.Root>
        <AxoChatEvent.Body variant="secondary" symbol="message-thread">
          You accepted {contact}’s message request
        </AxoChatEvent.Body>
        <AxoChatEvent.Action
          variant="subtle-destructive"
          onClick={action('onGoToMessage')}
        >
          Block or Report...
        </AxoChatEvent.Action>
      </AxoChatEvent.Root>
    </>
  );
}

export function ActionTooltip(): ReactNode {
  const contact = (
    <AxoChatEvent.InlineAction onClick={action('onShowContact')}>
      John
    </AxoChatEvent.InlineAction>
  );

  return (
    <AxoChatEvent.Root>
      <AxoChatEvent.Body variant="secondary" symbol="camera">
        {contact} started a video call
        <AxoChatEvent.Timestamp timestamp={TimestampMs.now()}>
          8m
        </AxoChatEvent.Timestamp>
      </AxoChatEvent.Body>
      <AxoTooltip.Root label="You are already in a call" delay="none">
        <AxoChatEvent.Action
          variant="subtle-affirmative"
          onClick={action('onGoToMessage')}
          discouraged
        >
          Join call
        </AxoChatEvent.Action>
      </AxoTooltip.Root>
    </AxoChatEvent.Root>
  );
}

export function BodyVariants(): ReactNode {
  return (
    <>
      <AxoChatEvent.Root>
        <AxoChatEvent.Body variant="secondary" symbol="camera">
          Incoming video call
        </AxoChatEvent.Body>
        <AxoChatEvent.Action
          variant="subtle-secondary"
          onClick={action('onGoToMessage')}
        >
          Call back
        </AxoChatEvent.Action>
      </AxoChatEvent.Root>

      <AxoChatEvent.Root>
        <AxoChatEvent.Body variant="destructive" symbol="phone">
          Declined voice call
        </AxoChatEvent.Body>
        <AxoChatEvent.Action
          variant="subtle-secondary"
          onClick={action('onGoToMessage')}
        >
          Call back
        </AxoChatEvent.Action>
      </AxoChatEvent.Root>
    </>
  );
}

export function LongText(): ReactNode {
  return (
    <AxoChatEvent.Root>
      <AxoChatEvent.Body variant="secondary" symbol="info">
        Lorem, ipsum dolor sit amet consectetur adipisicing elit. Voluptate
        expedita sunt vero sint ad, amet quas incidunt, explicabo dolorum harum
        laboriosam non praesentium quibusdam nemo tempora ducimus ipsa facere
        fugiat
      </AxoChatEvent.Body>
      <AxoChatEvent.Action
        variant="subtle-secondary"
        onClick={action('onGoToMessage')}
      >
        Learn More
      </AxoChatEvent.Action>
    </AxoChatEvent.Root>
  );
}

function RtlTemplate(props: {
  localeDir: AxoIntl.Direction;
  contactDir: AxoIntl.Direction;
}) {
  const contact = (
    <AxoChatEvent.InlineAction onClick={action('onShowContact')}>
      {props.contactDir === 'ltr' ? 'John' : 'مُحَمَّد'}
    </AxoChatEvent.InlineAction>
  );

  return (
    <AxoChatEvent.Root>
      <AxoChatEvent.Body variant="secondary" symbol="phone">
        {props.localeDir === 'ltr' ? (
          <>{contact} changed their phone number</>
        ) : (
          <>
            {'قام '}
            {contact}
            {' بتغيير رقم هاتفه'}
          </>
        )}
        <AxoChatEvent.Timestamp timestamp={TimestampMs.now()}>
          {props.localeDir === 'ltr' ? 'Now' : 'الآن'}
        </AxoChatEvent.Timestamp>
      </AxoChatEvent.Body>
    </AxoChatEvent.Root>
  );
}

export function RTL(): ReactNode {
  return (
    <>
      <div dir="rtl">
        <RtlTemplate localeDir="rtl" contactDir="rtl" />
        <RtlTemplate localeDir="rtl" contactDir="ltr" />
      </div>
      <div dir="ltr">
        <RtlTemplate localeDir="ltr" contactDir="ltr" />
        <RtlTemplate localeDir="ltr" contactDir="rtl" />
      </div>
    </>
  );
}
