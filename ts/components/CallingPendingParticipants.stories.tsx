// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingPendingParticipants';
import { CallingPendingParticipants } from './CallingPendingParticipants';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { allRemoteParticipants } from './CallScreen.stories';

const i18n = setupI18n('en', enMessages);

const createProps = (storyProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  participants: [allRemoteParticipants[0], allRemoteParticipants[1]],
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
        participants: [allRemoteParticipants[0]],
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
  const [countIndex, setCountIndex] = React.useState<number>(0);
  React.useEffect(() => {
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
        participants: [allRemoteParticipants[0]],
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
