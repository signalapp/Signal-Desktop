// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import {
  AddGroupMemberErrorDialog,
  AddGroupMemberErrorDialogMode,
} from './AddGroupMemberErrorDialog';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/AddGroupMemberErrorDialog',
};

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

export const _MaximumGroupSize = (): JSX.Element => (
  <AddGroupMemberErrorDialog
    {...defaultProps}
    mode={AddGroupMemberErrorDialogMode.MaximumGroupSize}
    maximumNumberOfContacts={123}
  />
);

_MaximumGroupSize.story = {
  name: 'Maximum group size',
};

export const MaximumRecommendedGroupSize = (): JSX.Element => (
  <AddGroupMemberErrorDialog
    {...defaultProps}
    mode={AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize}
    recommendedMaximumNumberOfContacts={123}
  />
);

MaximumRecommendedGroupSize.story = {
  name: 'Maximum recommended group size',
};
