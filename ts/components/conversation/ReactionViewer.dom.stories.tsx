// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ReactionViewer.dom.tsx';
import { ReactionViewer } from './ReactionViewer.dom.tsx';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.ts';
import { ThemeType } from '../../types/Util.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ReactionViewer',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  getPreferredBadge: () => undefined,
  i18n,
  onClose: action('onClose'),
  pickedReaction: overrideProps.pickedReaction,
  reactions: overrideProps.reactions || [],
  style: overrideProps.style,
  theme: ThemeType.light,
});

export function AllReactions(): React.JSX.Element {
  const props = createProps({
    reactions: [
      {
        emoji: '❤️',
        timestamp: 1,
        from: getDefaultConversation({
          id: '+14155552671',
          phoneNumber: '+14155552671',
          profileName: 'Ameila Briggs',
          title: 'Amelia',
        }),
      },
      {
        emoji: '❤️',
        timestamp: 2,
        from: getDefaultConversation({
          id: '+14155552672',
          name: 'Adam Burrel',
          title: 'Adam',
        }),
      },
      {
        emoji: '❤️',
        timestamp: 3,
        from: getDefaultConversation({
          id: '+14155552673',
          name: 'Rick Owens',
          title: 'Rick',
        }),
      },
      {
        emoji: '❤️',
        timestamp: 4,
        from: getDefaultConversation({
          id: '+14155552674',
          name: 'Bojack Horseman',
          title: 'Bojack',
        }),
      },
      {
        emoji: '👍',
        timestamp: 9,
        from: getDefaultConversation({
          id: '+14155552678',
          phoneNumber: '+14155552678',
          profileName: 'Adam Burrel',
          title: 'Adam',
        }),
      },
      {
        emoji: '👎',
        timestamp: 10,
        from: getDefaultConversation({
          id: '+14155552673',
          name: 'Rick Owens',
          title: 'Rick',
        }),
      },
      {
        emoji: '😂',
        timestamp: 11,
        from: getDefaultConversation({
          id: '+14155552674',
          name: 'Bojack Horseman',
          title: 'Bojack',
        }),
      },
      {
        emoji: '😮',
        timestamp: 12,
        from: getDefaultConversation({
          id: '+14155552675',
          name: 'Cayce Pollard',
          title: 'Cayce',
        }),
      },
      {
        emoji: '😢',
        timestamp: 13,
        from: getDefaultConversation({
          id: '+14155552676',
          name: 'Foo McBarrington',
          title: 'Foo',
        }),
      },
      {
        emoji: '😡',
        timestamp: 14,
        from: getDefaultConversation({
          id: '+14155552676',
          name: 'Foo McBarrington',
          title: 'Foo',
        }),
      },
    ],
  });
  return <ReactionViewer {...props} />;
}

export function PickedReaction(): React.JSX.Element {
  const props = createProps({
    pickedReaction: '❤️',
    reactions: [
      {
        emoji: '❤️',
        from: getDefaultConversation({
          id: '+14155552671',
          name: 'Amelia Briggs',
          isMe: true,
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: '👍',
        from: getDefaultConversation({
          id: '+14155552671',
          phoneNumber: '+14155552671',
          profileName: 'Joel Ferrari',
          title: 'Joel',
        }),
        timestamp: Date.now(),
      },
    ],
  });
  return <ReactionViewer {...props} />;
}

export function PickedMissingReaction(): React.JSX.Element {
  const props = createProps({
    pickedReaction: '😡',
    reactions: [
      {
        emoji: '❤️',
        from: getDefaultConversation({
          id: '+14155552671',
          name: 'Amelia Briggs',
          isMe: true,
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: '👍',
        from: getDefaultConversation({
          id: '+14155552671',
          phoneNumber: '+14155552671',
          profileName: 'Joel Ferrari',
          title: 'Joel',
        }),
        timestamp: Date.now(),
      },
    ],
  });
  return <ReactionViewer {...props} />;
}

const skinTones = [
  '\u{1F3FB}',
  '\u{1F3FC}',
  '\u{1F3FD}',
  '\u{1F3FE}',
  '\u{1F3FF}',
];
const thumbsUpHands = skinTones.map(skinTone => `👍${skinTone}`);
const okHands = skinTones.map(skinTone => `👌${skinTone}`).reverse();

const createReaction = (
  emoji: string,
  name: string,
  timestamp = Date.now()
) => ({
  emoji,
  from: getDefaultConversation({
    id: '+14155552671',
    name,
    title: name,
  }),
  timestamp,
});

export function ReactionSkinTones(): React.JSX.Element {
  const props = createProps({
    pickedReaction: '😡',
    reactions: [
      ...thumbsUpHands.map((emoji, n) =>
        createReaction(emoji, `Thumbs Up ${n + 1}`, Date.now() + n * 1000)
      ),
      ...okHands.map((emoji, n) =>
        createReaction(emoji, `Ok Hand ${n + 1}`, Date.now() + n * 1000)
      ),
    ],
  });
  return <ReactionViewer {...props} />;
}
