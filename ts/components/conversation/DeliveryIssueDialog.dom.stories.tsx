// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';
import type { DeliveryIssueDialogProps } from './DeliveryIssueDialog.dom.tsx';
import { DeliveryIssueDialog } from './DeliveryIssueDialog.dom.tsx';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';

const { i18n } = window.SignalContext;
const sender = getDefaultConversation();

export default {
  title: 'Components/Conversation/DeliveryIssueDialog',
} satisfies Meta<DeliveryIssueDialogProps>;

export function Default(): ReactNode {
  return (
    <DeliveryIssueDialog i18n={i18n} sender={sender} inGroup={false}>
      <AxoDialog.StoryTrigger />
    </DeliveryIssueDialog>
  );
}

export function InGroup(): ReactNode {
  return (
    <DeliveryIssueDialog i18n={i18n} sender={sender} inGroup>
      <AxoDialog.StoryTrigger />
    </DeliveryIssueDialog>
  );
}
