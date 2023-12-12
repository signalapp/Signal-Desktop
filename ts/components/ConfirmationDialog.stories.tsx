// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { Props } from './ConfirmationDialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ConfirmationDialog',
} satisfies Meta<Props>;

export function Basic(): JSX.Element {
  return (
    <ConfirmationDialog
      dialogName="test"
      i18n={i18n}
      onClose={action('onClose')}
      title="Foo bar banana baz?"
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
      asdf blip
    </ConfirmationDialog>
  );
}

export function CustomCancelText(): JSX.Element {
  return (
    <ConfirmationDialog
      dialogName="test"
      cancelText="Nah"
      i18n={i18n}
      onClose={action('onClose')}
      title="Maybs?"
      actions={[
        {
          text: 'Maybe',
          style: 'affirmative',
          action: action('affirmative'),
        },
      ]}
    >
      Because.
    </ConfirmationDialog>
  );
}

export function NoDefaultCancel(): JSX.Element {
  return (
    <ConfirmationDialog
      dialogName="test"
      noDefaultCancelButton
      i18n={i18n}
      onClose={action('onClose')}
      title="Do you?"
      actions={[
        {
          text: 'Yep',
          style: 'affirmative',
          action: action('affirmative'),
        },
      ]}
    >
      No default cancel!
    </ConfirmationDialog>
  );
}
