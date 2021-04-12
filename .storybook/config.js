// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { addDecorator, addParameters, configure } from '@storybook/react';
import { withKnobs, boolean, optionsKnob } from '@storybook/addon-knobs';
import classnames from 'classnames';
import * as styles from './styles.scss';
import messages from '../_locales/en/messages.json';
import { I18n } from '../sticker-creator/util/i18n';
import { ClassyProvider } from '../ts/components/PopperRootContext';

const optionsConfig = {
  display: 'inline-radio',
};

const persistKnob = id => knob => {
  const value = knob(localStorage.getItem(id));
  localStorage.setItem(id, value);
  return value;
};

const makeThemeKnob = pane =>
  persistKnob(`${pane}-pane-theme`)(localValue =>
    optionsKnob(
      `${pane} Pane Theme`,
      { Light: '', Dark: classnames('dark-theme', styles.darkTheme) },
      localValue || '',
      optionsConfig,
      `${pane} Pane`
    )
  );

const makeDeviceThemeKnob = pane =>
  persistKnob(`${pane}-pane-device-theme`)(localValue =>
    optionsKnob(
      `${pane} Pane Device Theme`,
      { Android: '', iOS: 'ios-theme' },
      localValue || '',
      optionsConfig,
      `${pane} Pane`
    )
  );

const makeModeKnob = pane =>
  persistKnob(`${pane}-pane-mode`)(localValue =>
    optionsKnob(
      `${pane} Pane Mode`,
      { Mouse: 'mouse-mode', Keyboard: 'keyboard-mode' },
      localValue || 'mouse-mode',
      optionsConfig,
      `${pane} Pane`
    )
  );

addDecorator(withKnobs);

addDecorator((storyFn /* , context */) => {
  const contents = storyFn();
  const firstPaneTheme = makeThemeKnob('First');
  const firstPaneDeviceTheme = makeDeviceThemeKnob('First');
  const firstPaneMode = makeModeKnob('First');

  const secondPane = persistKnob('second-pane-active')(localValue =>
    boolean('Second Pane Active', localValue !== 'false', 'Second Pane')
  );

  const secondPaneTheme = makeThemeKnob('Second');
  const secondPaneDeviceTheme = makeDeviceThemeKnob('Second');
  const secondPaneMode = makeModeKnob('Second');

  // Adding it to the body as well so that we can cover modals and other
  // components that are rendered outside of this decorator container
  if (firstPaneTheme === '') {
    document.body.classList.remove('dark-theme');
  } else {
    document.body.classList.add('dark-theme');
  }

  if (firstPaneDeviceTheme === '') {
    document.body.classList.remove('ios-theme');
  } else {
    document.body.classList.add('ios-theme');
  }

  if (firstPaneMode === 'mouse-mode') {
    document.body.classList.remove('keyboard-mode');
    document.body.classList.add('mouse-mode');
  } else {
    document.body.classList.remove('mouse-mode');
    document.body.classList.add('keyboard-mode');
  }

  return (
    <div className={styles.container}>
      <ClassyProvider themes={['dark']}>
        <div
          className={classnames(
            styles.panel,
            firstPaneTheme,
            firstPaneDeviceTheme,
            firstPaneMode
          )}
        >
          {contents}
        </div>
      </ClassyProvider>
      {secondPane ? (
        <div
          className={classnames(
            styles.panel,
            secondPaneTheme,
            secondPaneDeviceTheme,
            secondPaneMode
          )}
        >
          {contents}
        </div>
      ) : null}
    </div>
  );
});

// Hack to enable hooks in stories: https://github.com/storybookjs/storybook/issues/5721#issuecomment-473869398
addDecorator(Story => <Story />);

addDecorator(story => <I18n messages={messages}>{story()}</I18n>);

addParameters({
  axe: {
    disabledRules: ['html-has-lang'],
  },
});

configure(() => {
  // Load main app stories
  const tsComponentsContext = require.context(
    '../ts/components',
    true,
    /\.stories.tsx?$/
  );
  tsComponentsContext.keys().forEach(f => tsComponentsContext(f));
  // Load sticker creator stories
  const stickerCreatorContext = require.context(
    '../sticker-creator',
    true,
    /\.stories\.tsx?$/
  );
  stickerCreatorContext.keys().forEach(f => stickerCreatorContext(f));
}, module);
