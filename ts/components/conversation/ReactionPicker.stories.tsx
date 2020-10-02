import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { select } from '@storybook/addon-knobs';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { Props as ReactionPickerProps, ReactionPicker } from './ReactionPicker';
import { EmojiPicker } from '../emoji/EmojiPicker';

const i18n = setupI18n('en', enMessages);

const renderEmojiPicker: ReactionPickerProps['renderEmojiPicker'] = ({
  onClose,
  onPickEmoji,
  ref,
}) => (
  <EmojiPicker
    i18n={i18n}
    skinTone={0}
    onSetSkinTone={action('EmojiPicker::onSetSkinTone')}
    ref={ref}
    onClose={onClose}
    onPickEmoji={onPickEmoji}
  />
);

storiesOf('Components/Conversation/ReactionPicker', module)
  .add('Base', () => {
    return (
      <ReactionPicker
        i18n={i18n}
        onPick={action('onPick')}
        renderEmojiPicker={renderEmojiPicker}
        skinTone={0}
      />
    );
  })
  .add('Selected Reaction', () => {
    return ['❤️', '👍', '👎', '😂', '😮', '😢', '😡'].map(e => (
      <div key={e} style={{ height: '100px' }}>
        <ReactionPicker
          i18n={i18n}
          selected={e}
          onPick={action('onPick')}
          renderEmojiPicker={renderEmojiPicker}
          skinTone={0}
        />
      </div>
    ));
  })
  .add('Skin Tones', () => {
    return ['❤️', '👍', '👎', '😂', '😮', '😢', '😡'].map(e => (
      <div key={e} style={{ height: '100px' }}>
        <ReactionPicker
          i18n={i18n}
          selected={e}
          onPick={action('onPick')}
          renderEmojiPicker={renderEmojiPicker}
          skinTone={select(
            'skinTone',
            { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 },
            0
          )}
        />
      </div>
    ));
  });
