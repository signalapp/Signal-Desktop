// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupMemberLabelInfoModal.dom.js';
import { GroupMemberLabelInfoModal } from './GroupMemberLabelInfoModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/GroupMemberLabelInfoModal',
} satisfies Meta<PropsType>;

const createProps = (): PropsType => ({
  canAddLabel: true,
  hasLabel: false,
  i18n,
  isEditMemberLabelEnabled: true,
  onClose: action('onClose'),
  showEditMemberLabelScreen: action('showEditMemberLabelScreen'),
});

export function NoExistingLabel(): React.JSX.Element {
  return <GroupMemberLabelInfoModal {...createProps()} />;
}

export function ExistingLabel(): React.JSX.Element {
  const props = { ...createProps(), hasLabel: true };

  return <GroupMemberLabelInfoModal {...props} />;
}

export function CannotAddLabel(): React.JSX.Element {
  const props = {
    ...createProps(),
    canAddLabel: false,
  };

  return <GroupMemberLabelInfoModal {...props} />;
}

export function CanAddLabelButFeatureDisabled(): React.JSX.Element {
  const props = {
    ...createProps(),
    canAddLabel: false,
    isEditMemberLabelEnabled: true,
  };

  return <GroupMemberLabelInfoModal {...props} />;
}
