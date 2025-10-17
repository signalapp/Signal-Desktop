// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './SystemMessage.dom.js';
import { SystemMessage, SystemMessageKind } from './SystemMessage.dom.js';

export default {
  title: 'Components/Conversation/SystemMessage',
} satisfies Meta<PropsType>;

export function PlainSystemMessage(): JSX.Element {
  return (
    <SystemMessage
      icon="audio-incoming"
      contents="Some nice text"
      kind={SystemMessageKind.Normal}
    />
  );
}

export function DangerSystemMessage(): JSX.Element {
  return (
    <SystemMessage
      icon="audio-missed"
      contents="Some loud danger text"
      kind={SystemMessageKind.Danger}
    />
  );
}

export function ErrorSystemMessage(): JSX.Element {
  return (
    <SystemMessage
      icon="unsupported"
      contents="Some error text"
      kind={SystemMessageKind.Error}
    />
  );
}
