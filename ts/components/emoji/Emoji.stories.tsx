import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { Emoji, EmojiSizes, Props } from './Emoji';

const story = storiesOf('Components/Emoji/Emoji', module);

const tones = [0, 1, 2, 3, 4, 5];

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  size: select(
    'size',
    EmojiSizes.reduce((m, t) => ({ ...m, [t]: t }), {}),
    overrideProps.size || 48
  ),
  inline: boolean('inline', overrideProps.inline || false),
  emoji: text('emoji', overrideProps.emoji || ''),
  shortName: text('shortName', overrideProps.shortName || ''),
  skinTone: select(
    'skinTone',
    tones.reduce((m, t) => ({ ...m, [t]: t }), {}),
    overrideProps.skinTone || 0
  ),
});

story.add('Sizes', () => {
  const props = createProps({
    shortName: 'grinning_face_with_star_eyes',
  });

  return EmojiSizes.map(size => <Emoji key={size} {...props} size={size} />);
});

story.add('Skin Tones', () => {
  const props = createProps({
    shortName: 'raised_back_of_hand',
  });

  return tones.map(skinTone => (
    <Emoji key={skinTone} {...props} skinTone={skinTone} />
  ));
});

story.add('Inline', () => {
  const props = createProps({
    shortName: 'joy',
    inline: true,
  });

  return (
    <>
      <Emoji {...props} />
      <Emoji {...props} />
      <Emoji {...props} />
    </>
  );
});

story.add('From Emoji', () => {
  const props = createProps({
    emoji: '😂',
  });

  return <Emoji {...props} />;
});
