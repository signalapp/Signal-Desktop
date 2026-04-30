// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect, type JSX } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingPendingParticipants.dom.tsx';
import { CallingPendingParticipants } from './CallingPendingParticipants.dom.tsx';
import { allRemoteParticipants } from './CallScreen.dom.stories.tsx';
import { strictAssert } from '../util/assert.std.ts';

const { i18n } = window.SignalContext;

strictAssert(allRemoteParticipants[0], 'Missing allRemoteParticipants[0]');
strictAssert(allRemoteParticipants[1], 'Missing allRemoteParticipants[1]');
const participant1 = allRemoteParticipants[0];
const participant2 = allRemoteParticipants[1];

const createProps = (storyProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  participants: [participant1, participant2],
  approveUser: action('approve-user'),
  batchUserAction: action('batch-user-action'),
  denyUser: action('deny-user'),
  toggleCallLinkPendingParticipantModal: action(
    'toggle-call-link-pending-participant-modal'
  ),
  ...storyProps,
});

export default {
  title: 'Components/CallingPendingParticipants',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function One(): JSX.Element {
  return (
    <CallingPendingParticipants
      {...createProps({
        participants: [participant1],
      })}
    />
  );
}

export function Two(): JSX.Element {
  return (
    <CallingPendingParticipants
      {...createProps({
        participants: allRemoteParticipants.slice(0, 2),
      })}
    />
  );
}

export function Many(): JSX.Element {
  return (
    <CallingPendingParticipants
      {...createProps({
        participants: allRemoteParticipants.slice(0, 10),
      })}
    />
  );
}

export function Changing(): JSX.Element {
  const counts = [0, 1, 2, 3, 2, 1];
  const [countIndex, setCountIndex] = useState<number>(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCountIndex((countIndex + 1) % counts.length);
    }, 1000);

    return () => clearInterval(interval);
  }, [countIndex, counts.length]);

  return (
    <CallingPendingParticipants
      {...createProps({
        participants: allRemoteParticipants.slice(0, counts[countIndex]),
      })}
    />
  );
}

export function ExpandedOne(): JSX.Element {
  return (
    <CallingPendingParticipants
      {...createProps({
        defaultIsExpanded: true,
        participants: [participant1],
      })}
    />
  );
}

export function ExpandedTwo(): JSX.Element {
  return (
    <CallingPendingParticipants
      {...createProps({
        defaultIsExpanded: true,
        participants: allRemoteParticipants.slice(0, 2),
      })}
    />
  );
}

export function ExpandedMany(): JSX.Element {
  return (
    <CallingPendingParticipants
      {...createProps({
        defaultIsExpanded: true,
        participants: allRemoteParticipants.slice(0, 10),
      })}
    />
  );
}
