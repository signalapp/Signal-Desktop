import * as React from 'react';

// @ts-ignore
import { setup as setupI18n } from '../../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../../_locales/en/messages.json';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
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
        />
      </div>
    ));
  });
