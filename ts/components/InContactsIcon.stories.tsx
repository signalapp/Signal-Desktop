import * as React from 'react';

import { storiesOf } from '@storybook/react';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../\_locales/en/messages.json';

import { InContactsIcon } from './InContactsIcon';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/InContactsIcon', module).add('Default', () => {
  return <InContactsIcon i18n={i18n} />;
});
