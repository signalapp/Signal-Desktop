import * as React from 'react';

import { text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { Linkify, Props } from './Linkify';

const story = storiesOf('Components/Conversation/Linkify', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonLink: overrideProps.renderNonLink,
  text: text('text', overrideProps.text || ''),
});

story.add('Only Link', () => {
  const props = createProps({
    text: 'https://www.signal.org',
  });

  return <Linkify {...props} />;
});

story.add('Links with Text', () => {
  const props = createProps({
    text:
      'you should see this: https://www.signal.org - it is good. Also: https://placekitten.com!',
  });

  return <Linkify {...props} />;
});

story.add('No Link', () => {
  const props = createProps({
    text: 'I am fond of cats',
  });

  return <Linkify {...props} />;
});

story.add('Blocked Protocols', () => {
  const props = createProps({
    text:
      'smailto:someone@somewhere.com - ftp://something.com - //local/share - \\localshare',
  });

  return <Linkify {...props} />;
});

story.add('Missing Protocol', () => {
  const props = createProps({
    text: 'github.com is a place for things',
  });

  return <Linkify {...props} />;
});

story.add('Custom Text Render', () => {
  const props = createProps({
    text:
      'you should see this: https://www.signal.org - it is good. Also: https://placekitten.com!',
    renderNonLink: ({ text: theText, key }) => (
      <div key={key} style={{ backgroundColor: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <Linkify {...props} />;
});
