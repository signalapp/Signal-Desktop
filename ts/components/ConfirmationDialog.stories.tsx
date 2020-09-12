import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

import { ConfirmationDialog } from './ConfirmationDialog';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/ConfirmationDialog', module).add(
  'ConfirmationDialog',
  () => {
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
  }
);
