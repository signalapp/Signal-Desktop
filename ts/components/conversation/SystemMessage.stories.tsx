// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { SystemMessage, SystemMessageKind } from './SystemMessage';

export default {
  title: 'Components/Conversation/SystemMessage',
};

export function PlainSystemMessage(): JSX.Element {
  return (
    <SystemMessage
      icon="audio-incoming"
      contents="Some nice text"
      kind={SystemMessageKind.Normal}
    />
  );
}

PlainSystemMessage.story = {
  name: 'Plain',
};

export function DangerSystemMessage(): JSX.Element {
  return (
    <SystemMessage
      icon="audio-missed"
      contents="Some loud danger text"
      kind={SystemMessageKind.Danger}
    />
  );
}

DangerSystemMessage.story = {
  name: 'Danger',
};

export function ErrorSystemMessage(): JSX.Element {
  return (
    <SystemMessage
      icon="unsupported"
      contents="Some error text"
      kind={SystemMessageKind.Error}
    />
  );
}

ErrorSystemMessage.story = {
  name: 'Error',
};
