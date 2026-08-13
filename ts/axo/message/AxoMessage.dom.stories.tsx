// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import { AxoMessage } from './AxoMessage.dom.tsx';
import { SentTimestampMs } from '@signalapp/types';
import { action } from '@storybook/addon-actions';
import { tw } from '../tw.dom.tsx';

export default {
  title: 'Axo/Message/AxoMessage',
} satisfies Meta;

const BODY_SHORT = 'Lorem ipsum dolor sit amet consectetur, adipisicing elit.';

const BODY_MEDIUM =
  'Lorem ipsum dolor sit amet consectetur, adipisicing elit. Libero ' +
  'consequatur iure eaque mollitia! Recusandae sequi ullam reiciendis ' +
  'maiores, beatae consequuntur explicabo quos dicta, exercitationem ' +
  'magni perferendis autem doloribus odio dolorum.';

function Chat(props: { children: ReactNode }) {
  return <div className={tw('flex flex-col gap-2')}>{props.children}</div>;
}

function MessageGroup(props: { children: ReactNode }) {
  return <div className={tw('flex flex-col')}>{props.children}</div>;
}

function BasicTemplate(props: {
  direction?: AxoMessage.Direction;
  body?: string;
  timeDisplay?: string;
  collapseAbove?: boolean;
  collapseBelow?: boolean;
}) {
  return (
    <AxoMessage.Root direction={props.direction ?? 'incoming'}>
      <AxoMessage.Bubble
        collapseAbove={props.collapseAbove ?? false}
        collapseBelow={props.collapseBelow ?? false}
      >
        <AxoMessage.Text text={{ body: props.body ?? BODY_SHORT }} />
        <AxoMessage.Meta>
          <AxoMessage.MetaTimestamp sentAt={SentTimestampMs.now()}>
            {props.timeDisplay ?? 'Now'}
          </AxoMessage.MetaTimestamp>
        </AxoMessage.Meta>
      </AxoMessage.Bubble>
    </AxoMessage.Root>
  );
}

export function Basic(): ReactNode {
  return (
    <Chat>
      <MessageGroup>
        <BasicTemplate direction="incoming" body={BODY_SHORT} collapseBelow />
        <BasicTemplate direction="incoming" body={BODY_MEDIUM} collapseAbove />
      </MessageGroup>
      <MessageGroup>
        <BasicTemplate direction="outgoing" body={BODY_SHORT} collapseBelow />
        <BasicTemplate direction="outgoing" body={BODY_MEDIUM} collapseAbove />
      </MessageGroup>
      <BasicTemplate direction="incoming" body={BODY_MEDIUM} />
      <BasicTemplate direction="outgoing" body={BODY_MEDIUM} />
    </Chat>
  );
}

export function Timestamp(): ReactNode {
  return (
    <Chat>
      <BasicTemplate timeDisplay="Now" />
      <BasicTemplate timeDisplay="1m" />
      <BasicTemplate timeDisplay="5m" />
      <BasicTemplate timeDisplay="10m" />
      <BasicTemplate timeDisplay="30m" />
      <BasicTemplate timeDisplay="1:11pm" />
      <BasicTemplate timeDisplay="12:55pm" />
    </Chat>
  );
}

function PartiallySentTemplate(props: { direction: AxoMessage.Direction }) {
  return (
    <AxoMessage.Root direction={props.direction}>
      <AxoMessage.Bubble collapseAbove={false} collapseBelow={false}>
        <AxoMessage.Text text={{ body: BODY_SHORT }} />
        <AxoMessage.Meta>
          <AxoMessage.MetaAction onClick={action('onRetrySend')}>
            Partially sent, click to retry
          </AxoMessage.MetaAction>
        </AxoMessage.Meta>
      </AxoMessage.Bubble>
    </AxoMessage.Root>
  );
}

export function PartiallySent(): ReactNode {
  return (
    <Chat>
      <PartiallySentTemplate direction="incoming" />
      <PartiallySentTemplate direction="outgoing" />
    </Chat>
  );
}

function OutgoingStatusTemplate(props: {
  outgoingStatus: AxoMessage.OutgoingStatus;
}) {
  return (
    <AxoMessage.Root direction="outgoing">
      <AxoMessage.Bubble collapseAbove={false} collapseBelow={false}>
        <AxoMessage.Text text={{ body: BODY_SHORT }} />
        <AxoMessage.Meta>
          <AxoMessage.MetaTimestamp sentAt={SentTimestampMs.now()}>
            Now
          </AxoMessage.MetaTimestamp>
          <AxoMessage.MetaOutgoingStatus status={props.outgoingStatus} />
        </AxoMessage.Meta>
      </AxoMessage.Bubble>
    </AxoMessage.Root>
  );
}

export function OutgoingStatus(): ReactNode {
  return (
    <Chat>
      <OutgoingStatusTemplate outgoingStatus="sending" />
      <OutgoingStatusTemplate outgoingStatus="sent" />
      <OutgoingStatusTemplate outgoingStatus="delivered" />
      <OutgoingStatusTemplate outgoingStatus="read" />
    </Chat>
  );
}

export function Wrapping(): ReactNode {
  return (
    <div className={tw('w-[50ch] resize-x overflow-auto border p-2')}>
      <Chat>
        <BasicTemplate body={'x'.repeat(35)} />
        <BasicTemplate body={'x'.repeat(36)} />
        <BasicTemplate body={'x'.repeat(37)} />
        <BasicTemplate body={'x'.repeat(38)} />
        <BasicTemplate body={'x'.repeat(39)} />
        <BasicTemplate body={'x'.repeat(40)} />
      </Chat>
    </div>
  );
}
