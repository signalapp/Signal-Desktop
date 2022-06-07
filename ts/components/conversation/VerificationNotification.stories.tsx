// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { boolean } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './VerificationNotification';
import { VerificationNotification } from './VerificationNotification';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/VerificationNotification',
};

const contact = { title: 'Mr. Fire' };

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  type: overrideProps.type || 'markVerified',
  isLocal: boolean('isLocal', overrideProps.isLocal !== false),
  contact: overrideProps.contact || contact,
});

export const MarkAsVerified = (): JSX.Element => {
  const props = createProps({ type: 'markVerified' });

  return <VerificationNotification {...props} />;
};

MarkAsVerified.story = {
  name: 'Mark as Verified',
};

export const MarkAsNotVerified = (): JSX.Element => {
  const props = createProps({ type: 'markNotVerified' });

  return <VerificationNotification {...props} />;
};

MarkAsNotVerified.story = {
  name: 'Mark as Not Verified',
};

export const MarkAsVerifiedRemotely = (): JSX.Element => {
  const props = createProps({ type: 'markVerified', isLocal: false });

  return <VerificationNotification {...props} />;
};

MarkAsVerifiedRemotely.story = {
  name: 'Mark as Verified Remotely',
};

export const MarkAsNotVerifiedRemotely = (): JSX.Element => {
  const props = createProps({ type: 'markNotVerified', isLocal: false });

  return <VerificationNotification {...props} />;
};

MarkAsNotVerifiedRemotely.story = {
  name: 'Mark as Not Verified Remotely',
};

export const LongName = (): JSX.Element => {
  const longName = '🎆🍬🏈'.repeat(50);

  const props = createProps({
    type: 'markVerified',
    contact: { title: longName },
  });

  return <VerificationNotification {...props} />;
};

LongName.story = {
  name: 'Long name',
};
