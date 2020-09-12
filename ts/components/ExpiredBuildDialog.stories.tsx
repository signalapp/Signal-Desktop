import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean } from '@storybook/addon-knobs';

import { ExpiredBuildDialog } from './ExpiredBuildDialog';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/ExpiredBuildDialog', module).add(
  'ExpiredBuildDialog',
  () => {
    const hasExpired = boolean('hasExpired', true);

    return <ExpiredBuildDialog hasExpired={hasExpired} i18n={i18n} />;
  }
);
