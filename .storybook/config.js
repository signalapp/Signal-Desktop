import * as React from 'react';
import { addDecorator, configure } from '@storybook/react';
import { withKnobs, boolean, optionsKnob } from '@storybook/addon-knobs';
import classnames from 'classnames';
import * as styles from './styles.scss';
import messages from '../_locales/en/messages.json';
import { I18n } from '../sticker-creator/util/i18n';
import { ClassyProvider } from '../ts/components/PopperRootContext';

const optionsConfig = {
  display: 'inline-radio',
};

const makeThemeKnob = pane =>
  optionsKnob(
    `${pane} Pane Theme`,
    { Light: '', Dark: classnames('dark-theme', styles.darkTheme) },
    '',
    optionsConfig,
    `${pane} Pane`
  );

const makeDeviceThemeKnob = pane =>
  optionsKnob(
    `${pane} Pane Device Theme`,
    { Android: '', iOS: 'ios-theme' },
    '',
    optionsConfig,
    `${pane} Pane`
  );

const makeModeKnob = pane =>
  optionsKnob(
    `${pane} Pane Mode`,
    { Mouse: 'mouse-mode', Keyboard: 'keyboard-mode' },
    'mouse-mode',
    optionsConfig,
    `${pane} Pane`
  );

addDecorator(withKnobs);

addDecorator((storyFn /* , context */) => {
  const contents = storyFn();
  const firstPaneTheme = makeThemeKnob('First');
  const firstPaneDeviceTheme = makeDeviceThemeKnob('First');
  const firstPaneMode = makeModeKnob('First');

  const secondPane = boolean('Second Pane Active', false, 'Second Pane');

  const secondPaneTheme = makeThemeKnob('Second');
  const secondPaneDeviceTheme = makeDeviceThemeKnob('Second');
  const secondPaneMode = makeModeKnob('Second');

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

configure(() => {
  // Load sticker creator stories
  const stickerCreatorContext = require.context(
    '../sticker-creator',
    true,
    /\.stories\.tsx?$/
  );
  stickerCreatorContext.keys().forEach(f => stickerCreatorContext(f));
  // Load main app stories
  const tsComponentsContext = require.context(
    '../ts/components',
    true,
    /\.stories.tsx?$/
  );
  tsComponentsContext.keys().forEach(f => tsComponentsContext(f));
}, module);
