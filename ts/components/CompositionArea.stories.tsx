import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { CompositionArea, Props } from './CompositionArea';

// tslint:disable-next-line
import 'draft-js/dist/Draft.css';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';

// @ts-ignore
import enMessages from '../../_locales/en/messages.json';
import { boolean } from '@storybook/addon-knobs';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/CompositionArea', module);

// necessary for the add attachment button to render properly
story.addDecorator(storyFn => <div className="file-input">{storyFn()}</div>);

// necessary for the mic button to render properly
const micCellEl = new DOMParser().parseFromString(
  `
    <div class="capture-audio">
      <button class="microphone"></button>
    </div>
  `,
  'text/html'
).body.firstElementChild as HTMLElement;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  micCellEl,
  onChooseAttachment: action('onChooseAttachment'),
  // CompositionInput
  onSubmit: action('onSubmit'),
  onEditorSizeChange: action('onEditorSizeChange'),
  onEditorStateChange: action('onEditorStateChange'),
  onTextTooLong: action('onTextTooLong'),
  startingText: overrideProps.startingText || undefined,
  clearQuotedMessage: action('clearQuotedMessage'),
  getQuotedMessage: action('getQuotedMessage'),
  // EmojiButton
  onPickEmoji: action('onPickEmoji'),
  onSetSkinTone: action('onSetSkinTone'),
  recentEmojis: [],
  skinTone: 1,
  // StickerButton
  knownPacks: overrideProps.knownPacks || [],
  receivedPacks: [],
  installedPacks: [],
  blessedPacks: [],
  recentStickers: [],
  clearInstalledStickerPack: action('clearInstalledStickerPack'),
  onClickAddPack: action('onClickAddPack'),
  onPickSticker: action('onPickSticker'),
  clearShowIntroduction: action('clearShowIntroduction'),
  showPickerHint: false,
  clearShowPickerHint: action('clearShowPickerHint'),
  // Message Requests
  conversationType: 'direct',
  onAccept: action('onAccept'),
  onBlock: action('onBlock'),
  onBlockAndDelete: action('onBlockAndDelete'),
  onDelete: action('onDelete'),
  onUnblock: action('onUnblock'),
  messageRequestsEnabled: boolean(
    'messageRequestsEnabled',
    overrideProps.messageRequestsEnabled || false
  ),
  title: '',
});

story.add('Default', () => {
  const props = createProps();

  return <CompositionArea {...props} />;
});

story.add('Starting Text', () => {
  const props = createProps({
    startingText: "here's some starting text",
  });

  return <CompositionArea {...props} />;
});

story.add('Sticker Button', () => {
  const props = createProps({
    knownPacks: [{} as any],
  });

  return <CompositionArea {...props} />;
});

story.add('Message Request', () => {
  const props = createProps({
    messageRequestsEnabled: true,
  });

  return <CompositionArea {...props} />;
});
