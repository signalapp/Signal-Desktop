// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

import { ContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ContactSpoofingReviewDialog',
  module
);

story.add('Default', () => (
  <ContactSpoofingReviewDialog
    i18n={i18n}
    onBlock={action('onBlock')}
    onBlockAndDelete={action('onBlockAndDelete')}
    onClose={action('onClose')}
    onDelete={action('onDelete')}
    onShowContactModal={action('onShowContactModal')}
    onUnblock={action('onUnblock')}
    possiblyUnsafeConversation={getDefaultConversation()}
    safeConversation={getDefaultConversation()}
  />
));
