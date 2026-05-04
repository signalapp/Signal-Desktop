// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ReactionViewer.dom.tsx';
import { ReactionViewer } from './ReactionViewer.dom.tsx';
import { getDefaultConversation } from '../../test-helpers/getDefaultConversation.std.ts';
import { ThemeType } from '../../types/Util.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

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

export function AllReactions(): JSX.Element {
  const props = createProps({
    reactions: [
      {
        emoji: Emoji.HEART,
        timestamp: 1,
        from: getDefaultConversation({
          id: '+14155552671',
          phoneNumber: '+14155552671',
          profileName: 'Ameila Briggs',
          title: 'Amelia',
        }),
      },
      {
        emoji: Emoji.HEART,
        timestamp: 2,
        from: getDefaultConversation({
          id: '+14155552672',
          name: 'Adam Burrel',
          title: 'Adam',
        }),
      },
      {
        emoji: Emoji.HEART,
        timestamp: 3,
        from: getDefaultConversation({
          id: '+14155552673',
          name: 'Rick Owens',
          title: 'Rick',
        }),
      },
      {
        emoji: Emoji.HEART,
        timestamp: 4,
        from: getDefaultConversation({
          id: '+14155552674',
          name: 'Bojack Horseman',
          title: 'Bojack',
        }),
      },
      {
        emoji: Emoji.getDefaultVariant(Emoji.THUMBS_UP),
        timestamp: 9,
        from: getDefaultConversation({
          id: '+14155552678',
          phoneNumber: '+14155552678',
          profileName: 'Adam Burrel',
          title: 'Adam',
        }),
      },
      {
        emoji: Emoji.getDefaultVariant(Emoji.THUMBS_DOWN),
        timestamp: 10,
        from: getDefaultConversation({
          id: '+14155552673',
          name: 'Rick Owens',
          title: 'Rick',
        }),
      },
      {
        emoji: Emoji.JOY,
        timestamp: 11,
        from: getDefaultConversation({
          id: '+14155552674',
          name: 'Bojack Horseman',
          title: 'Bojack',
        }),
      },
      {
        emoji: Emoji.OPEN_MOUTH,
        timestamp: 12,
        from: getDefaultConversation({
          id: '+14155552675',
          name: 'Cayce Pollard',
          title: 'Cayce',
        }),
      },
      {
        emoji: Emoji.CRY,
        timestamp: 13,
        from: getDefaultConversation({
          id: '+14155552676',
          name: 'Foo McBarrington',
          title: 'Foo',
        }),
      },
      {
        emoji: Emoji.RAGE,
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

export function PickedReaction(): JSX.Element {
  const props = createProps({
    pickedReaction: Emoji.HEART,
    reactions: [
      {
        emoji: Emoji.HEART,
        from: getDefaultConversation({
          id: '+14155552671',
          name: 'Amelia Briggs',
          isMe: true,
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: Emoji.getDefaultVariant(Emoji.THUMBS_UP),
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

export function PickedMissingReaction(): JSX.Element {
  const props = createProps({
    pickedReaction: Emoji.RAGE,
    reactions: [
      {
        emoji: Emoji.HEART,
        from: getDefaultConversation({
          id: '+14155552671',
          name: 'Amelia Briggs',
          isMe: true,
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: Emoji.getDefaultVariant(Emoji.THUMBS_UP),
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

const thumbsUpHands = Emoji.SKIN_TONE_ORDER.map(skinTone => {
  return Emoji.getVariant(Emoji.THUMBS_UP, skinTone);
});

const okHands = Emoji.SKIN_TONE_ORDER.map(skinTone => {
  return Emoji.getVariant(Emoji.OK_HAND, skinTone);
}).toReversed();

const createReaction = (
  emoji: Emoji.Variant,
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

export function ReactionSkinTones(): JSX.Element {
  const props = createProps({
    pickedReaction: Emoji.RAGE,
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
