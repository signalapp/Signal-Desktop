// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './AddGroupMemberErrorDialog';
import {
  AddGroupMemberErrorDialog,
  AddGroupMemberErrorDialogMode,
} from './AddGroupMemberErrorDialog';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/AddGroupMemberErrorDialog',
} satisfies Meta<PropsType>;

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

export function MaximumGroupSize(): JSX.Element {
  return (
    <AddGroupMemberErrorDialog
      {...defaultProps}
      mode={AddGroupMemberErrorDialogMode.MaximumGroupSize}
      maximumNumberOfContacts={123}
    />
  );
}

export function MaximumRecommendedGroupSize(): JSX.Element {
  return (
    <AddGroupMemberErrorDialog
      {...defaultProps}
      mode={AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize}
      recommendedMaximumNumberOfContacts={123}
    />
  );
}
