// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { action } from '@storybook/addon-actions';
import type { ComponentMeta } from '../storybook/types.std.js';
import type { CallLinkDetailsProps } from './CallLinkDetails.dom.js';
import { CallLinkDetails } from './CallLinkDetails.dom.js';
import {
  FAKE_CALL_LINK,
  FAKE_CALL_LINK_WITH_ADMIN_KEY,
} from '../test-helpers/fakeCallLink.std.js';
import { getFakeCallLinkHistoryGroup } from '../test-helpers/getFakeCallHistoryGroup.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CallLinkDetails',
  component: CallLinkDetails,
  argTypes: {},
  args: {
    i18n,
    callHistoryGroup: getFakeCallLinkHistoryGroup(),
    callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
    isAnybodyInCall: false,
    isCallActiveOnServer: false,
    isInCall: false,
    isInAnotherCall: false,
    onDeleteCallLink: action('onDeleteCallLink'),
    onOpenCallLinkAddNameModal: action('onOpenCallLinkAddNameModal'),
    onStartCallLinkLobby: action('onStartCallLinkLobby'),
    onShareCallLinkViaSignal: action('onShareCallLinkViaSignal'),
    onUpdateCallLinkRestrictions: action('onUpdateCallLinkRestrictions'),
  },
} satisfies ComponentMeta<CallLinkDetailsProps>;

export function Admin(args: CallLinkDetailsProps): JSX.Element {
  return <CallLinkDetails {...args} />;
}

export function AdminAndCallActive(args: CallLinkDetailsProps): JSX.Element {
  return <CallLinkDetails {...args} isAnybodyInCall isCallActiveOnServer />;
}

export function AdminAndInCall(args: CallLinkDetailsProps): JSX.Element {
  return (
    <CallLinkDetails {...args} isAnybodyInCall isCallActiveOnServer isInCall />
  );
}

export function AdminRecentlyEndedCall(
  args: CallLinkDetailsProps
): JSX.Element {
  return <CallLinkDetails {...args} isCallActiveOnServer />;
}

export function NonAdmin(args: CallLinkDetailsProps): JSX.Element {
  return <CallLinkDetails {...args} callLink={FAKE_CALL_LINK} />;
}

export function NonAdminAndCallActive(args: CallLinkDetailsProps): JSX.Element {
  return (
    <CallLinkDetails
      {...args}
      callLink={FAKE_CALL_LINK}
      isAnybodyInCall
      isCallActiveOnServer
    />
  );
}

export function InAnotherCall(args: CallLinkDetailsProps): JSX.Element {
  return (
    <CallLinkDetails
      {...args}
      callLink={FAKE_CALL_LINK}
      isInAnotherCall
      isCallActiveOnServer
    />
  );
}

export function InAnotherCallAndCallActive(
  args: CallLinkDetailsProps
): JSX.Element {
  return (
    <CallLinkDetails
      {...args}
      callLink={FAKE_CALL_LINK}
      isAnybodyInCall
      isCallActiveOnServer
      isInAnotherCall
    />
  );
}

export function MissingCallLink(args: CallLinkDetailsProps): JSX.Element {
  return <CallLinkDetails {...args} callLink={undefined} />;
}
