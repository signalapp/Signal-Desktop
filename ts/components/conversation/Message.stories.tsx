// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean } from 'lodash';

import { action } from '@storybook/addon-actions';
import { boolean, number, select, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { SignalService } from '../../protobuf';
import { ConversationColors } from '../../types/Colors';
import { EmojiPicker } from '../emoji/EmojiPicker';
import type { Props, AudioAttachmentProps } from './Message';
import { Message } from './Message';
import {
  AUDIO_MP3,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  VIDEO_MP4,
  stringToMIMEType,
} from '../../types/MIME';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { MessageAudio } from './MessageAudio';
import { computePeaks } from '../GlobalAudioContext';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { pngUrl } from '../../storybook/Fixtures';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { WidthBreakpoint } from '../_util';

import { fakeAttachment } from '../../test-both/helpers/fakeAttachment';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

function getJoyReaction() {
  return {
    emoji: '😂',
    from: getDefaultConversation({
      id: '+14155552674',
      phoneNumber: '+14155552674',
      name: 'Amelia Briggs',
      title: 'Amelia',
    }),
    timestamp: Date.now() - 10,
  };
}

const story = storiesOf('Components/Conversation/Message', module);

const renderEmojiPicker: Props['renderEmojiPicker'] = ({
  onClose,
  onPickEmoji,
  ref,
}) => (
  <EmojiPicker
    i18n={setupI18n('en', enMessages)}
    skinTone={0}
    onSetSkinTone={action('EmojiPicker::onSetSkinTone')}
    ref={ref}
    onClose={onClose}
    onPickEmoji={onPickEmoji}
  />
);

const renderReactionPicker: Props['renderReactionPicker'] = () => <div />;

const MessageAudioContainer: React.FC<AudioAttachmentProps> = props => {
  const [active, setActive] = React.useState<{
    id?: string;
    context?: string;
  }>({});
  const audio = React.useMemo(() => new Audio(), []);

  return (
    <MessageAudio
      {...props}
      id="storybook"
      renderingContext="storybook"
      audio={audio}
      computePeaks={computePeaks}
      setActiveAudioID={(id, context) => setActive({ id, context })}
      onFirstPlayed={action('onFirstPlayed')}
      activeAudioID={active.id}
      activeAudioContext={active.context}
    />
  );
};

const renderAudioAttachment: Props['renderAudioAttachment'] = props => (
  <MessageAudioContainer {...props} />
);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  attachments: overrideProps.attachments,
  author: overrideProps.author || getDefaultConversation(),
  reducedMotion: boolean('reducedMotion', false),
  bodyRanges: overrideProps.bodyRanges,
  canReply: true,
  canDownload: true,
  canDeleteForEveryone: overrideProps.canDeleteForEveryone || false,
  checkForAccount: action('checkForAccount'),
  clearSelectedMessage: action('clearSelectedMessage'),
  collapseMetadata: overrideProps.collapseMetadata,
  containerElementRef: React.createRef<HTMLElement>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationColor:
    overrideProps.conversationColor ||
    select('conversationColor', ConversationColors, ConversationColors[0]),
  conversationId: text('conversationId', overrideProps.conversationId || ''),
  conversationType: overrideProps.conversationType || 'direct',
  deletedForEveryone: overrideProps.deletedForEveryone,
  deleteMessage: action('deleteMessage'),
  deleteMessageForEveryone: action('deleteMessageForEveryone'),
  disableMenu: overrideProps.disableMenu,
  disableScroll: overrideProps.disableScroll,
  direction: overrideProps.direction || 'incoming',
  displayTapToViewMessage: action('displayTapToViewMessage'),
  doubleCheckMissingQuoteReference: action('doubleCheckMissingQuoteReference'),
  downloadAttachment: action('downloadAttachment'),
  expirationLength:
    number('expirationLength', overrideProps.expirationLength || 0) ||
    undefined,
  expirationTimestamp:
    number('expirationTimestamp', overrideProps.expirationTimestamp || 0) ||
    undefined,
  getPreferredBadge: overrideProps.getPreferredBadge || (() => undefined),
  i18n,
  id: text('id', overrideProps.id || ''),
  renderingContext: 'storybook',
  interactionMode: overrideProps.interactionMode || 'keyboard',
  isSticker: isBoolean(overrideProps.isSticker)
    ? overrideProps.isSticker
    : false,
  isBlocked: isBoolean(overrideProps.isBlocked)
    ? overrideProps.isBlocked
    : false,
  isMessageRequestAccepted: isBoolean(overrideProps.isMessageRequestAccepted)
    ? overrideProps.isMessageRequestAccepted
    : true,
  isTapToView: overrideProps.isTapToView,
  isTapToViewError: overrideProps.isTapToViewError,
  isTapToViewExpired: overrideProps.isTapToViewExpired,
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  markViewed: action('markViewed'),
  messageExpanded: action('messageExpanded'),
  onHeightChange: action('onHeightChange'),
  openConversation: action('openConversation'),
  openLink: action('openLink'),
  previews: overrideProps.previews || [],
  reactions: overrideProps.reactions,
  reactToMessage: action('reactToMessage'),
  readStatus:
    overrideProps.readStatus === undefined
      ? ReadStatus.Read
      : overrideProps.readStatus,
  renderEmojiPicker,
  renderReactionPicker,
  renderAudioAttachment,
  replyToMessage: action('replyToMessage'),
  retrySend: action('retrySend'),
  scrollToQuotedMessage: action('scrollToQuotedMessage'),
  selectMessage: action('selectMessage'),
  showContactDetail: action('showContactDetail'),
  showContactModal: action('showContactModal'),
  showExpiredIncomingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showExpiredOutgoingTapToViewToast: action(
    'showExpiredOutgoingTapToViewToast'
  ),
  showForwardMessageModal: action('showForwardMessageModal'),
  showMessageDetail: action('showMessageDetail'),
  showVisualAttachment: action('showVisualAttachment'),
  status: overrideProps.status || 'sent',
  text: overrideProps.text || text('text', ''),
  textPending: boolean('textPending', overrideProps.textPending || false),
  theme: ThemeType.light,
  timestamp: number('timestamp', overrideProps.timestamp || Date.now()),
});

const renderBothDirections = (props: Props) => (
  <>
    <Message {...props} />
    <br />
    <Message {...props} direction="outgoing" />
  </>
);

story.add('Plain Message', () => {
  const props = createProps({
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderBothDirections(props);
});

story.add('Emoji Messages', () => (
  <>
    <Message {...createProps({ text: '😀' })} />
    <br />
    <Message {...createProps({ text: '😀😀' })} />
    <br />
    <Message {...createProps({ text: '😀😀😀' })} />
    <br />
    <Message {...createProps({ text: '😀😀😀😀' })} />
    <br />
    <Message {...createProps({ text: '😀😀😀😀😀' })} />
    <br />
    <Message {...createProps({ text: '😀😀😀😀😀😀😀' })} />
    <br />
    <Message
      {...createProps({
        previews: [
          {
            domain: 'signal.org',
            image: fakeAttachment({
              contentType: IMAGE_PNG,
              fileName: 'the-sax.png',
              height: 240,
              url: pngUrl,
              width: 320,
            }),
            isStickerPack: false,
            title: 'Signal',
            description:
              'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
            url: 'https://www.signal.org',
            date: new Date(2020, 2, 10).valueOf(),
          },
        ],
        text: '😀',
      })}
    />
    <br />
    <Message
      {...createProps({
        attachments: [
          fakeAttachment({
            url: '/fixtures/tina-rolf-269345-unsplash.jpg',
            fileName: 'tina-rolf-269345-unsplash.jpg',
            contentType: IMAGE_JPEG,
            width: 128,
            height: 128,
          }),
        ],
        text: '😀',
      })}
    />
    <br />
    <Message
      {...createProps({
        attachments: [
          fakeAttachment({
            contentType: AUDIO_MP3,
            fileName: 'incompetech-com-Agnus-Dei-X.mp3',
            url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
          }),
        ],
        text: '😀',
      })}
    />
    <br />
    <Message
      {...createProps({
        attachments: [
          fakeAttachment({
            contentType: stringToMIMEType('text/plain'),
            fileName: 'my-resume.txt',
            url: 'my-resume.txt',
          }),
        ],
        text: '😀',
      })}
    />
    <br />
    <Message
      {...createProps({
        attachments: [
          fakeAttachment({
            contentType: VIDEO_MP4,
            flags: SignalService.AttachmentPointer.Flags.GIF,
            fileName: 'cat-gif.mp4',
            url: '/fixtures/cat-gif.mp4',
            width: 400,
            height: 332,
          }),
        ],
        text: '😀',
      })}
    />
  </>
));

story.add('Delivered', () => {
  const props = createProps({
    direction: 'outgoing',
    status: 'delivered',
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return <Message {...props} />;
});

story.add('Read', () => {
  const props = createProps({
    direction: 'outgoing',
    status: 'read',
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return <Message {...props} />;
});

story.add('Sending', () => {
  const props = createProps({
    direction: 'outgoing',
    status: 'sending',
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return <Message {...props} />;
});

story.add('Expiring', () => {
  const props = createProps({
    expirationLength: 30 * 1000,
    expirationTimestamp: Date.now() + 30 * 1000,
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderBothDirections(props);
});

story.add('Pending', () => {
  const props = createProps({
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
    textPending: true,
  });

  return renderBothDirections(props);
});

story.add('Collapsed Metadata', () => {
  const props = createProps({
    author: getDefaultConversation({ title: 'Fred Willard' }),
    collapseMetadata: true,
    conversationType: 'group',
    text: 'Hello there from a pal!',
  });

  return renderBothDirections(props);
});

story.add('Recent', () => {
  const props = createProps({
    text: 'Hello there from a pal!',
    timestamp: Date.now() - 30 * 60 * 1000,
  });

  return renderBothDirections(props);
});

story.add('Older', () => {
  const props = createProps({
    text: 'Hello there from a pal!',
    timestamp: Date.now() - 180 * 24 * 60 * 60 * 1000,
  });

  return renderBothDirections(props);
});

story.add('Reactions (wider message)', () => {
  const props = createProps({
    text: 'Hello there from a pal!',
    timestamp: Date.now() - 180 * 24 * 60 * 60 * 1000,
    reactions: [
      {
        emoji: '👍',
        from: getDefaultConversation({
          isMe: true,
          id: '+14155552672',
          phoneNumber: '+14155552672',
          name: 'Me',
          title: 'Me',
        }),
        timestamp: Date.now() - 10,
      },
      {
        emoji: '👍',
        from: getDefaultConversation({
          id: '+14155552672',
          phoneNumber: '+14155552672',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now() - 10,
      },
      {
        emoji: '👍',
        from: getDefaultConversation({
          id: '+14155552673',
          phoneNumber: '+14155552673',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now() - 10,
      },
      {
        emoji: '😂',
        from: getDefaultConversation({
          id: '+14155552674',
          phoneNumber: '+14155552674',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now() - 10,
      },
      {
        emoji: '😡',
        from: getDefaultConversation({
          id: '+14155552677',
          phoneNumber: '+14155552677',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now() - 10,
      },
      {
        emoji: '👎',
        from: getDefaultConversation({
          id: '+14155552678',
          phoneNumber: '+14155552678',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now() - 10,
      },
      {
        emoji: '❤️',
        from: getDefaultConversation({
          id: '+14155552679',
          phoneNumber: '+14155552679',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now() - 10,
      },
    ],
  });

  return renderBothDirections(props);
});

const joyReactions = Array.from({ length: 52 }, () => getJoyReaction());

story.add('Reactions (short message)', () => {
  const props = createProps({
    text: 'h',
    timestamp: Date.now(),
    reactions: [
      ...joyReactions,
      {
        emoji: '👍',
        from: getDefaultConversation({
          isMe: true,
          id: '+14155552672',
          phoneNumber: '+14155552672',
          name: 'Me',
          title: 'Me',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: '👍',
        from: getDefaultConversation({
          id: '+14155552672',
          phoneNumber: '+14155552672',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: '👍',
        from: getDefaultConversation({
          id: '+14155552673',
          phoneNumber: '+14155552673',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: '😡',
        from: getDefaultConversation({
          id: '+14155552677',
          phoneNumber: '+14155552677',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: '👎',
        from: getDefaultConversation({
          id: '+14155552678',
          phoneNumber: '+14155552678',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
      {
        emoji: '❤️',
        from: getDefaultConversation({
          id: '+14155552679',
          phoneNumber: '+14155552679',
          name: 'Amelia Briggs',
          title: 'Amelia',
        }),
        timestamp: Date.now(),
      },
    ],
  });

  return renderBothDirections(props);
});

story.add('Avatar in Group', () => {
  const props = createProps({
    author: getDefaultConversation({ avatarPath: pngUrl }),
    conversationType: 'group',
    status: 'sent',
    text: 'Hello it is me, the saxophone.',
  });

  return <Message {...props} />;
});

story.add('Badge in Group', () => {
  const props = createProps({
    conversationType: 'group',
    getPreferredBadge: () => getFakeBadge(),
    status: 'sent',
    text: 'Hello it is me, the saxophone.',
  });

  return <Message {...props} />;
});

story.add('Sticker', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        url: '/fixtures/512x515-thumbs-up-lincoln.webp',
        fileName: '512x515-thumbs-up-lincoln.webp',
        contentType: IMAGE_WEBP,
        width: 128,
        height: 128,
      }),
    ],
    isSticker: true,
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Deleted', () => {
  const props = createProps({
    conversationType: 'group',
    deletedForEveryone: true,
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Deleted with expireTimer', () => {
  const props = createProps({
    timestamp: Date.now() - 60 * 1000,
    conversationType: 'group',
    deletedForEveryone: true,
    expirationLength: 5 * 60 * 1000,
    expirationTimestamp: Date.now() + 3 * 60 * 1000,
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Can delete for everyone', () => {
  const props = createProps({
    status: 'read',
    text: 'I hope you get this.',
    canDeleteForEveryone: true,
  });

  return <Message {...props} direction="outgoing" />;
});

story.add('Error', () => {
  const props = createProps({
    status: 'error',
    text: 'I hope you get this.',
  });

  return renderBothDirections(props);
});

story.add('Paused', () => {
  const props = createProps({
    status: 'paused',
    text: 'I am up to a challenge',
  });

  return renderBothDirections(props);
});

story.add('Partial Send', () => {
  const props = createProps({
    status: 'partial-sent',
    text: 'I hope you get this.',
  });

  return renderBothDirections(props);
});

story.add('Link Preview', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        image: fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'the-sax.png',
          height: 240,
          url: pngUrl,
          width: 320,
        }),
        isStickerPack: false,
        title: 'Signal',
        description:
          'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
        url: 'https://www.signal.org',
        date: new Date(2020, 2, 10).valueOf(),
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
  });

  return renderBothDirections(props);
});

story.add('Link Preview with Small Image', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        image: fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'the-sax.png',
          height: 50,
          url: pngUrl,
          width: 50,
        }),
        isStickerPack: false,
        title: 'Signal',
        description:
          'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
        url: 'https://www.signal.org',
        date: new Date(2020, 2, 10).valueOf(),
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
  });

  return renderBothDirections(props);
});

story.add('Link Preview without Image', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        isStickerPack: false,
        title: 'Signal',
        description:
          'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
        url: 'https://www.signal.org',
        date: new Date(2020, 2, 10).valueOf(),
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
  });

  return renderBothDirections(props);
});

story.add('Link Preview with no description', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        isStickerPack: false,
        title: 'Signal',
        url: 'https://www.signal.org',
        date: Date.now(),
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
  });

  return renderBothDirections(props);
});

story.add('Link Preview with long description', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        isStickerPack: false,
        title: 'Signal',
        description: Array(10)
          .fill(
            'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.'
          )
          .join(' '),
        url: 'https://www.signal.org',
        date: Date.now(),
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
  });

  return renderBothDirections(props);
});

story.add('Link Preview with small image, long description', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        image: fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'the-sax.png',
          height: 50,
          url: pngUrl,
          width: 50,
        }),
        isStickerPack: false,
        title: 'Signal',
        description: Array(10)
          .fill(
            'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.'
          )
          .join(' '),
        url: 'https://www.signal.org',
        date: Date.now(),
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
  });

  return renderBothDirections(props);
});

story.add('Link Preview with no date', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        image: fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'the-sax.png',
          height: 240,
          url: pngUrl,
          width: 320,
        }),
        isStickerPack: false,
        title: 'Signal',
        description:
          'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
        url: 'https://www.signal.org',
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
  });

  return renderBothDirections(props);
});

story.add('Link Preview with too new a date', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        image: fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'the-sax.png',
          height: 240,
          url: pngUrl,
          width: 320,
        }),
        isStickerPack: false,
        title: 'Signal',
        description:
          'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
        url: 'https://www.signal.org',
        date: Date.now() + 3000000000,
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
  });

  return renderBothDirections(props);
});

story.add('Image', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        fileName: 'tina-rolf-269345-unsplash.jpg',
        contentType: IMAGE_JPEG,
        width: 128,
        height: 128,
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

for (let i = 2; i <= 5; i += 1) {
  story.add(`Multiple Images x${i}`, () => {
    const props = createProps({
      attachments: [
        fakeAttachment({
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          fileName: 'tina-rolf-269345-unsplash.jpg',
          contentType: IMAGE_JPEG,
          width: 128,
          height: 128,
        }),
        fakeAttachment({
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          fileName: 'tina-rolf-269345-unsplash.jpg',
          contentType: IMAGE_JPEG,
          width: 128,
          height: 128,
        }),
        fakeAttachment({
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          fileName: 'tina-rolf-269345-unsplash.jpg',
          contentType: IMAGE_JPEG,
          width: 128,
          height: 128,
        }),
        fakeAttachment({
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          fileName: 'tina-rolf-269345-unsplash.jpg',
          contentType: IMAGE_JPEG,
          width: 128,
          height: 128,
        }),
        fakeAttachment({
          url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          fileName: 'tina-rolf-269345-unsplash.jpg',
          contentType: IMAGE_JPEG,
          width: 128,
          height: 128,
        }),
      ].slice(0, i),
      status: 'sent',
    });

    return renderBothDirections(props);
  });
}

story.add('Image with Caption', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        fileName: 'tina-rolf-269345-unsplash.jpg',
        contentType: IMAGE_JPEG,
        width: 128,
        height: 128,
      }),
    ],
    status: 'sent',
    text: 'This is my home.',
  });

  return renderBothDirections(props);
});

story.add('GIF', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        flags: SignalService.AttachmentPointer.Flags.GIF,
        fileName: 'cat-gif.mp4',
        url: '/fixtures/cat-gif.mp4',
        width: 400,
        height: 332,
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('GIF in a group', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        flags: SignalService.AttachmentPointer.Flags.GIF,
        fileName: 'cat-gif.mp4',
        url: '/fixtures/cat-gif.mp4',
        width: 400,
        height: 332,
      }),
    ],
    conversationType: 'group',
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Not Downloaded GIF', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        flags: SignalService.AttachmentPointer.Flags.GIF,
        fileName: 'cat-gif.mp4',
        fileSize: '188.61 KB',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        width: 400,
        height: 332,
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Pending GIF', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        pending: true,
        contentType: VIDEO_MP4,
        flags: SignalService.AttachmentPointer.Flags.GIF,
        fileName: 'cat-gif.mp4',
        fileSize: '188.61 KB',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        width: 400,
        height: 332,
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Audio', () => {
  const Wrapper = () => {
    const [isPlayed, setIsPlayed] = React.useState(false);

    const messageProps = createProps({
      attachments: [
        fakeAttachment({
          contentType: AUDIO_MP3,
          fileName: 'incompetech-com-Agnus-Dei-X.mp3',
          url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
        }),
      ],
      ...(isPlayed
        ? {
            status: 'viewed',
            readStatus: ReadStatus.Viewed,
          }
        : {
            status: 'read',
            readStatus: ReadStatus.Read,
          }),
    });

    return (
      <>
        <button
          type="button"
          onClick={() => {
            setIsPlayed(old => !old);
          }}
          style={{
            display: 'block',
            marginBottom: '2em',
          }}
        >
          Toggle played
        </button>
        {renderBothDirections(messageProps)}
      </>
    );
  };

  return <Wrapper />;
});

story.add('Long Audio', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: AUDIO_MP3,
        fileName: 'long-audio.mp3',
        url: '/fixtures/long-audio.mp3',
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Audio with Caption', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: AUDIO_MP3,
        fileName: 'incompetech-com-Agnus-Dei-X.mp3',
        url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
      }),
    ],
    status: 'sent',
    text: 'This is what I sound like.',
  });

  return renderBothDirections(props);
});

story.add('Audio with Not Downloaded Attachment', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: AUDIO_MP3,
        fileName: 'incompetech-com-Agnus-Dei-X.mp3',
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Audio with Pending Attachment', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: AUDIO_MP3,
        fileName: 'incompetech-com-Agnus-Dei-X.mp3',
        pending: true,
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Other File Type', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: stringToMIMEType('text/plain'),
        fileName: 'my-resume.txt',
        url: 'my-resume.txt',
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Other File Type with Caption', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: stringToMIMEType('text/plain'),
        fileName: 'my-resume.txt',
        url: 'my-resume.txt',
      }),
    ],
    status: 'sent',
    text: 'This is what I have done.',
  });

  return renderBothDirections(props);
});

story.add('Other File Type with Long Filename', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: stringToMIMEType('text/plain'),
        fileName:
          'INSERT-APP-NAME_INSERT-APP-APPLE-ID_AppStore_AppsGamesWatch.psd.zip',
        url: 'a2/a2334324darewer4234',
      }),
    ],
    status: 'sent',
    text: 'This is what I have done.',
  });

  return renderBothDirections(props);
});

story.add('TapToView Image', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        fileName: 'tina-rolf-269345-unsplash.jpg',
        contentType: IMAGE_JPEG,
        width: 128,
        height: 128,
      }),
    ],
    isTapToView: true,
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('TapToView Video', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'pixabay-Soap-Bubble-7141.mp4',
        height: 128,
        url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
        width: 128,
      }),
    ],
    isTapToView: true,
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('TapToView GIF', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        flags: SignalService.AttachmentPointer.Flags.GIF,
        fileName: 'cat-gif.mp4',
        url: '/fixtures/cat-gif.mp4',
        width: 400,
        height: 332,
      }),
    ],
    isTapToView: true,
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('TapToView Expired', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        fileName: 'tina-rolf-269345-unsplash.jpg',
        contentType: IMAGE_JPEG,
        width: 128,
        height: 128,
      }),
    ],
    isTapToView: true,
    isTapToViewExpired: true,
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('TapToView Error', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        fileName: 'tina-rolf-269345-unsplash.jpg',
        contentType: IMAGE_JPEG,
        width: 128,
        height: 128,
      }),
    ],
    isTapToView: true,
    isTapToViewError: true,
    status: 'sent',
  });

  return <Message {...props} />;
});

story.add('Dangerous File Type', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: stringToMIMEType(
          'application/vnd.microsoft.portable-executable'
        ),
        fileName: 'terrible.exe',
        url: 'terrible.exe',
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
});

story.add('Colors', () => {
  return (
    <>
      {ConversationColors.map(color => (
        <div key={color}>
          {renderBothDirections(
            createProps({
              conversationColor: color,
              text: `Here is a preview of the chat color: ${color}. The color is visible to only you.`,
            })
          )}
        </div>
      ))}
    </>
  );
});

story.add('@Mentions', () => {
  const props = createProps({
    bodyRanges: [
      {
        start: 0,
        length: 1,
        mentionUuid: 'zap',
        replacementText: 'Zapp Brannigan',
      },
    ],
    text: '\uFFFC This Is It. The Moment We Should Have Trained For.',
  });

  return renderBothDirections(props);
});

story.add('All the context menus', () => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        url: '/fixtures/tina-rolf-269345-unsplash.jpg',
        fileName: 'tina-rolf-269345-unsplash.jpg',
        contentType: IMAGE_JPEG,
        width: 128,
        height: 128,
      }),
    ],
    status: 'partial-sent',
    canDeleteForEveryone: true,
  });

  return <Message {...props} direction="outgoing" />;
});

story.add('Not approved, with link preview', () => {
  const props = createProps({
    previews: [
      {
        domain: 'signal.org',
        image: fakeAttachment({
          contentType: IMAGE_PNG,
          fileName: 'the-sax.png',
          height: 240,
          url: pngUrl,
          width: 320,
        }),
        isStickerPack: false,
        title: 'Signal',
        description:
          'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
        url: 'https://www.signal.org',
        date: new Date(2020, 2, 10).valueOf(),
      },
    ],
    status: 'sent',
    text: 'Be sure to look at https://www.signal.org',
    isMessageRequestAccepted: false,
  });

  return renderBothDirections(props);
});

story.add('Custom Color', () => (
  <>
    <Message
      {...createProps({ text: 'Solid.' })}
      direction="outgoing"
      customColor={{
        start: { hue: 82, saturation: 35 },
      }}
    />
    <br style={{ clear: 'both' }} />
    <Message
      {...createProps({ text: 'Gradient.' })}
      direction="outgoing"
      customColor={{
        deg: 192,
        start: { hue: 304, saturation: 85 },
        end: { hue: 231, saturation: 76 },
      }}
    />
  </>
));
