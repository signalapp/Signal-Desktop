import * as React from 'react';
import { ExpiredBuildDialog } from './ExpiredBuildDialog';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../_locales/en/messages.json';

import { storiesOf } from '@storybook/react';
import { boolean } from '@storybook/addon-knobs';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/ExpiredBuildDialog', module).add(
  'ExpiredBuildDialog',
  () => {
    const hasExpired = boolean('hasExpired', true);

    return <ExpiredBuildDialog hasExpired={hasExpired} i18n={i18n} />;
  }
);
