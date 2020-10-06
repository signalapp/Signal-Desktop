import * as React from 'react';
import { storiesOf } from '@storybook/react';

import { ProgressModal } from './ProgressModal';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/ProgressModal', module).add('Normal', () => {
  return <ProgressModal i18n={i18n} />;
});
