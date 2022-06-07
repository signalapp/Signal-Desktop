// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

import { ConfirmationDialog } from './ConfirmationDialog';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ConfirmationDialog',
};

export const _ConfirmationDialog = (): JSX.Element => {
  return (
    <ConfirmationDialog
      i18n={i18n}
      onClose={action('onClose')}
      title={text('Title', 'Foo bar banana baz?')}
      actions={[
        {
          text: 'Negate',
          style: 'negative',
          action: action('negative'),
        },
        {
          text: 'Affirm',
          style: 'affirmative',
          action: action('affirmative'),
        },
      ]}
    >
      {text('Child text', 'asdf blip')}
    </ConfirmationDialog>
  );
};

_ConfirmationDialog.story = {
  name: 'ConfirmationDialog',
};

export const CustomCancelText = (): JSX.Element => {
  return (
    <ConfirmationDialog
      cancelText="Nah"
      i18n={i18n}
      onClose={action('onClose')}
      title={text('Title', 'Foo bar banana baz?')}
      actions={[
        {
          text: 'Maybe',
          style: 'affirmative',
          action: action('affirmative'),
        },
      ]}
    >
      {text('Child text', 'asdf blip')}
    </ConfirmationDialog>
  );
};

CustomCancelText.story = {
  name: 'Custom cancel text',
};
