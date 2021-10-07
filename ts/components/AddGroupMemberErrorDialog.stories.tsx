// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import {
  AddGroupMemberErrorDialog,
  AddGroupMemberErrorDialogMode,
} from './AddGroupMemberErrorDialog';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/AddGroupMemberErrorDialog', module);

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

story.add("Can't add a contact", () => (
  <AddGroupMemberErrorDialog
    {...defaultProps}
    mode={AddGroupMemberErrorDialogMode.CantAddContact}
    contact={{ title: 'Foo Bar' }}
  />
));

story.add('Maximum group size', () => (
  <AddGroupMemberErrorDialog
    {...defaultProps}
    mode={AddGroupMemberErrorDialogMode.MaximumGroupSize}
    maximumNumberOfContacts={123}
  />
));

story.add('Maximum recommended group size', () => (
  <AddGroupMemberErrorDialog
    {...defaultProps}
    mode={AddGroupMemberErrorDialogMode.RecommendedMaximumGroupSize}
    recommendedMaximumNumberOfContacts={123}
  />
));
