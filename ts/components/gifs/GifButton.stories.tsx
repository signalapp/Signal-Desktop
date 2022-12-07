import React from 'react';
import type { DecoratorFunction } from '@storybook/addons';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './GifButton';
import { GifButton } from './GifButton';
import { getUnwrappedGiphyForStorybook } from '../../services/GiphyRendererWrapper';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/GIFs/GifButton',
  decorators: [
    storyFn => (
      <div
        style={{
          height: '500px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
        }}
      >
        {storyFn()}
      </div>
    ),
  ] as Array<DecoratorFunction<JSX.Element>>,
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  onPickGif: action('onPickGif'),
  recentGifs: [],
  giphyWrapper: getUnwrappedGiphyForStorybook(),
  ...overrideProps,
});

const withOverrideProps = (overrideProps?: Partial<Props>): React.FC => {
  const props = createProps(overrideProps);
  const wrapper = () => <GifButton {...props} />;
  wrapper.displayName = `WithOverrideProps(${GifButton.displayName})`;
  return wrapper;
};

export const Default = withOverrideProps(undefined);
