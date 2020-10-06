import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { ProgressDialog, PropsType } from './ProgressDialog';
import { setup as setupI18n } from '../../js/modules/i18n';

import enMessages from '../../_locales/en/messages.json';

const story = storiesOf('Components/ProgressDialog', module);

const i18n = setupI18n('en', enMessages);

const createProps = (): PropsType => ({
  i18n,
});

story.add('Normal', () => {
  const props = createProps();

  return <ProgressDialog {...props} />;
});
