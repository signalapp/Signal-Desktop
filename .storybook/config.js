import * as React from 'react';
import { addDecorator, configure } from '@storybook/react';
import { withKnobs } from '@storybook/addon-knobs';
import classnames from 'classnames';
import * as styles from './styles.scss';
import messages from '../_locales/en/messages.json';
import { I18n } from '../sticker-creator/util/i18n';
import { ThemedProvider } from '../ts/components/PopperRootContext';

addDecorator(withKnobs);

addDecorator((storyFn /* , context */) => {
  const contents = storyFn();

  return (
    <div className={styles.container}>
      <div className={styles.panel}>{contents}</div>
      <ThemedProvider themes={['dark']}>
        <div
          className={classnames(styles.darkTheme, styles.panel, 'dark-theme')}
        >
          {contents}
        </div>
      </ThemedProvider>
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
}, module);
