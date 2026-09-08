// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import type { Meta } from '@storybook/react';
import { SignalAccountKeys } from './SignalAccountKeys.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Preferences/SignalAccountKeys',
} satisfies Meta;

export function Default(): JSX.Element {
  return (
    <SignalAccountKeys
      i18n={i18n}
      serviceId="f83a157c-aed6-41ff-9d84-637c7af95f02"
      backupKey="22rsumdlqxa8r7lsghj12ah6ae2anhk4vjvccor4pc75mee49i9t9dcwmvso4wyn"
      saveAccountKeysPDF={() => Promise.resolve()}
    />
  );
}

export function Print(): JSX.Element {
  return (
    <SignalAccountKeys
      i18n={i18n}
      serviceId="f83a157c-aed6-41ff-9d84-637c7af95f02"
      backupKey="22rsumdlqxa8r7lsghj12ah6ae2anhk4vjvccor4pc75mee49i9t9dcwmvso4wyn"
      saveAccountKeysPDF={undefined}
    />
  );
}
