import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

import { Props, ReactionViewer } from './ReactionViewer';

// @ts-ignore
import { setup as setupI18n } from '../../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../../_locales/en/messages.json';
const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/ReactionViewer', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  onClose: action('onClose'),
  pickedReaction: overrideProps.pickedReaction,
  reactions: overrideProps.reactions || [],
  style: overrideProps.style,
});

story.add('All Reactions', () => {
  const props = createProps({
    reactions: [
      {
        emoji: '❤️',
        timestamp: 1,
        from: {
          id: '+14155552671',
          phoneNumber: '+14155552671',
          profileName: 'Ameila Briggs',
          title: 'Amelia',
        },
      },
      {
        emoji: '❤️',
        timestamp: 2,
        from: {
          id: '+14155552672',
          name: 'Adam Burrel',
          title: 'Adam',
        },
      },
      {
        emoji: '❤️',
        timestamp: 3,
        from: {
          id: '+14155552673',
          name: 'Rick Owens',
          title: 'Rick',
        },
      },
      {
        emoji: '❤️',
        timestamp: 4,
        from: {
          id: '+14155552674',
          name: 'Bojack Horseman',
          title: 'Bojack',
        },
      },
      {
        emoji: '👍',
        timestamp: 9,
        from: {
          id: '+14155552678',
          phoneNumber: '+14155552678',
          profileName: 'Adam Burrel',
          title: 'Adam',
        },
      },
      {
        emoji: '👎',
        timestamp: 10,
        from: {
          id: '+14155552673',
          name: 'Rick Owens',
          title: 'Rick',
        },
      },
      {
        emoji: '😂',
        timestamp: 11,
        from: {
          id: '+14155552674',
          name: 'Bojack Horseman',
          title: 'Bojack',
        },
      },
      {
        emoji: '😮',
        timestamp: 12,
        from: {
          id: '+14155552675',
          name: 'Cayce Pollard',
          title: 'Cayce',
        },
      },
      {
        emoji: '😢',
        timestamp: 13,
        from: {
          id: '+14155552676',
          name: 'Foo McBarrington',
          title: 'Foo',
        },
      },
      {
        emoji: '😡',
        timestamp: 14,
        from: {
          id: '+14155552676',
          name: 'Foo McBarrington',
          title: 'Foo',
        },
      },
    ],
  });
  return <ReactionViewer {...props} />;
});

story.add('Picked Reaction', () => {
  const props = createProps({
    pickedReaction: '❤️',
    reactions: [
      {
        emoji: '❤️',
        from: {
          id: '+14155552671',
          name: 'Amelia Briggs',
          isMe: true,
          title: 'Amelia',
        },
        timestamp: Date.now(),
      },
      {
        emoji: '👍',
        from: {
          id: '+14155552671',
          phoneNumber: '+14155552671',
          profileName: 'Joel Ferrari',
          title: 'Joel',
        },
        timestamp: Date.now(),
      },
    ],
  });
  return <ReactionViewer {...props} />;
});

story.add('Picked Missing Reaction', () => {
  const props = createProps({
    pickedReaction: '😡',
    reactions: [
      {
        emoji: '❤️',
        from: {
          id: '+14155552671',
          name: 'Amelia Briggs',
          isMe: true,
          title: 'Amelia',
        },
        timestamp: Date.now(),
      },
      {
        emoji: '👍',
        from: {
          id: '+14155552671',
          phoneNumber: '+14155552671',
          profileName: 'Joel Ferrari',
          title: 'Joel',
        },
        timestamp: Date.now(),
      },
    ],
  });
  return <ReactionViewer {...props} />;
});
