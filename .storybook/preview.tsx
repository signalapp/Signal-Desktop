// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classnames from 'classnames';
import { withKnobs, boolean, optionsKnob } from '@storybook/addon-knobs';

import * as styles from './styles.scss';
import messages from '../_locales/en/messages.json';
import { ClassyProvider } from '../ts/components/PopperRootContext';
import { I18n } from '../sticker-creator/util/i18n';
import { StorybookThemeContext } from './StorybookThemeContext';
import { ThemeType } from '../ts/types/Util';

export const globalTypes = {
  mode: {
    name: 'Mode',
    description: 'Application mode',
    defaultValue: 'mouse',
    toolbar: {
      dynamicTitle: true,
      icon: 'circlehollow',
      items: ['mouse', 'keyboard'],
      showName: true,
    },
  },
  theme: {
    name: 'Theme',
    description: 'Global theme for components',
    defaultValue: 'light',
    toolbar: {
      dynamicTitle: true,
      icon: 'circlehollow',
      items: ['light', 'dark'],
      showName: true,
    },
  },
};

const withModeAndThemeProvider = (Story, context) => {
  const theme =
    context.globals.theme === 'light' ? ThemeType.light : ThemeType.dark;
  const mode = context.globals.mode;

  // Adding it to the body as well so that we can cover modals and other
  // components that are rendered outside of this decorator container
  if (theme === 'light') {
    document.body.classList.remove('dark-theme');
  } else {
    document.body.classList.add('dark-theme');
  }

  if (mode === 'mouse') {
    document.body.classList.remove('keyboard-mode');
    document.body.classList.add('mouse-mode');
  } else {
    document.body.classList.remove('mouse-mode');
    document.body.classList.add('keyboard-mode');
  }

  document.body.classList.add('page-is-visible');

  return (
    <div className={styles.container}>
      <StorybookThemeContext.Provider value={theme}>
        <Story {...context} />
      </StorybookThemeContext.Provider>
    </div>
  );
};

const withI18n = (Story, context) => (
  <I18n messages={messages}>
    <Story {...context} />
  </I18n>
);

export const decorators = [
  withModeAndThemeProvider,
  withI18n,
];

export const parameters = {
  axe: {
    disabledRules: ['html-has-lang'],
  },
};
