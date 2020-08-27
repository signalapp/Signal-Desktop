import * as React from 'react';

import { boolean, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { MessageBody, Props } from './MessageBody';

// @ts-ignore
import { setup as setupI18n } from '../../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../../_locales/en/messages.json';
const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/MessageBody', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  disableJumbomoji: boolean(
    'disableJumbomoji',
    overrideProps.disableJumbomoji || false
  ),
  disableLinks: boolean('disableLinks', overrideProps.disableLinks || false),
  i18n,
  text: text('text', overrideProps.text || ''),
  textPending: boolean('textPending', overrideProps.textPending || false),
});

story.add('Links Enabled', () => {
  const props = createProps({
    text: 'Check out https://www.signal.org',
  });

  return <MessageBody {...props} />;
});

story.add('Links Disabled', () => {
  const props = createProps({
    disableLinks: true,
    text: 'Check out https://www.signal.org',
  });

  return <MessageBody {...props} />;
});

story.add('Emoji Size Based On Count', () => {
  const props = createProps();

  return (
    <>
      <MessageBody {...props} text="😹" />
      <br />
      <MessageBody {...props} text="😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹😹😹" />
      <br />
      <MessageBody {...props} text="😹😹😹😹😹😹😹😹😹" />
    </>
  );
});

story.add('Jumbomoji Enabled', () => {
  const props = createProps({
    text: '😹',
  });

  return <MessageBody {...props} />;
});

story.add('Jumbomoji Disabled', () => {
  const props = createProps({
    disableJumbomoji: true,
    text: '😹',
  });

  return <MessageBody {...props} />;
});

story.add('Jumbomoji Disabled by Text', () => {
  const props = createProps({
    text: 'not a jumbo kitty 😹',
  });

  return <MessageBody {...props} />;
});

story.add('Text Pending', () => {
  const props = createProps({
    text: 'Check out https://www.signal.org',
    textPending: true,
  });

  return <MessageBody {...props} />;
});
