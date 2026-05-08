// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import {
  AddGroupMemberMaximumGroupSizeErrorDialog,
  AddGroupMemberRecommendedMaximumGroupSizeErrorDialog,
} from './AddGroupMemberErrorDialog.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/AddGroupMemberErrorDialog',
} satisfies Meta;

export function MaximumGroupSize(): JSX.Element {
  return (
    <AddGroupMemberMaximumGroupSizeErrorDialog
      i18n={i18n}
      onClose={action('onClose')}
      maximumNumberOfContacts={123}
    />
  );
}

export function MaximumRecommendedGroupSize(): JSX.Element {
  return (
    <AddGroupMemberRecommendedMaximumGroupSizeErrorDialog
      i18n={i18n}
      onClose={action('onClose')}
      recommendedMaximumNumberOfContacts={123}
    />
  );
}
