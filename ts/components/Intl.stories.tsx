// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import type { Props } from './Intl';
import { Intl } from './Intl';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);
const story = storiesOf('Components/Intl', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  id: text('id', overrideProps.id || 'deleteAndRestart'),
  components: overrideProps.components,
  renderText: overrideProps.renderText,
});

story.add('No Replacements', () => {
  const props = createProps({
    id: 'deleteAndRestart',
  });

  return <Intl {...props} />;
});

story.add('Single String Replacement', () => {
  const props = createProps({
    id: 'leftTheGroup',
    components: ['Theodora'],
  });

  return <Intl {...props} />;
});

story.add('Single Tag Replacement', () => {
  const props = createProps({
    id: 'leftTheGroup',
    components: [
      <button type="button" key="a-button">
        Theodora
      </button>,
    ],
  });

  return <Intl {...props} />;
});

story.add('Multiple String Replacement', () => {
  const props = createProps({
    id: 'changedRightAfterVerify',
    components: {
      name1: 'Fred',
      name2: 'The Fredster',
    },
  });

  return <Intl {...props} />;
});

story.add('Multiple Tag Replacement', () => {
  const props = createProps({
    id: 'changedRightAfterVerify',
    components: {
      name1: <b>Fred</b>,
      name2: <b>The Fredster</b>,
    },
  });

  return <Intl {...props} />;
});

story.add('Custom Render', () => {
  const props = createProps({
    id: 'deleteAndRestart',
    renderText: ({ text: theText, key }) => (
      <div style={{ backgroundColor: 'purple', color: 'orange' }} key={key}>
        {theText}
      </div>
    ),
  });

  return <Intl {...props} />;
});
