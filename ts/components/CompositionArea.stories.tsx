// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';

import { CompositionArea, Props } from './CompositionArea';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

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
  onEditorStateChange: action('onEditorStateChange'),
  onTextTooLong: action('onTextTooLong'),
  draftText: overrideProps.draftText || undefined,
  clearQuotedMessage: action('clearQuotedMessage'),
  getQuotedMessage: action('getQuotedMessage'),
  members: [],
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
  // GroupV1 Disabled Actions
  onStartGroupMigration: action('onStartGroupMigration'),
});

story.add('Default', () => {
  const props = createProps();

  return <CompositionArea {...props} />;
});

story.add('Starting Text', () => {
  const props = createProps({
    draftText: "here's some starting text",
  });

  return <CompositionArea {...props} />;
});

story.add('Sticker Button', () => {
  const props = createProps({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
