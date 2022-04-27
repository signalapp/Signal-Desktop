// Copyright 2020-2022 Signal Messenger, LLC
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
import { TextDirection, Message } from './Message';
import {
  AUDIO_MP3,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  VIDEO_MP4,
  stringToMIMEType,
  IMAGE_GIF,
} from '../../types/MIME';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { MessageAudio } from './MessageAudio';
import { computePeaks } from '../GlobalAudioContext';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { pngUrl } from '../../storybook/Fixtures';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { WidthBreakpoint } from '../_util';
import { MINUTE } from '../../util/durations';
import { ContactFormType } from '../../types/EmbeddedContact';

import {
  fakeAttachment,
  fakeThumbnail,
} from '../../test-both/helpers/fakeAttachment';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';
import { UUID } from '../../types/UUID';

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
  canReact: true,
  canReply: true,
  canDownload: true,
  canDeleteForEveryone: overrideProps.canDeleteForEveryone || false,
  canRetry: overrideProps.canRetry || false,
  canRetryDeleteForEveryone: overrideProps.canRetryDeleteForEveryone || false,
  checkForAccount: action('checkForAccount'),
  clearSelectedMessage: action('clearSelectedMessage'),
  containerElementRef: React.createRef<HTMLElement>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationColor:
    overrideProps.conversationColor ||
    select('conversationColor', ConversationColors, ConversationColors[0]),
  conversationId: text('conversationId', overrideProps.conversationId || ''),
  conversationType: overrideProps.conversationType || 'direct',
  contact: overrideProps.contact,
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
  retryDeleteForEveryone: action('retryDeleteForEveryone'),
  scrollToQuotedMessage: action('scrollToQuotedMessage'),
  selectMessage: action('selectMessage'),
  shouldCollapseAbove: isBoolean(overrideProps.shouldCollapseAbove)
    ? overrideProps.shouldCollapseAbove
    : false,
  shouldCollapseBelow: isBoolean(overrideProps.shouldCollapseBelow)
    ? overrideProps.shouldCollapseBelow
    : false,
  shouldHideMetadata: isBoolean(overrideProps.shouldHideMetadata)
    ? overrideProps.shouldHideMetadata
    : false,
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
  startConversation: action('startConversation'),
  status: overrideProps.status || 'sent',
  text: overrideProps.text || text('text', ''),
  textDirection: overrideProps.textDirection || TextDirection.Default,
  textPending: boolean('textPending', overrideProps.textPending || false),
  theme: ThemeType.light,
  timestamp: number('timestamp', overrideProps.timestamp || Date.now()),
});

const createTimelineItem = (data: undefined | Props) =>
  data && {
    type: 'message' as const,
    data,
    timestamp: data.timestamp,
  };

const renderMany = (propsArray: ReadonlyArray<Props>) =>
  propsArray.map((message, index) => (
    <Message
      key={message.text}
      {...message}
      shouldCollapseAbove={Boolean(propsArray[index - 1])}
      item={createTimelineItem(message)}
      shouldCollapseBelow={Boolean(propsArray[index + 1])}
    />
  ));

const renderThree = (props: Props) => renderMany([props, props, props]);

const renderBothDirections = (props: Props) => (
  <>
    {renderThree(props)}
    {renderThree({
      ...props,
      author: { ...props.author, id: getDefaultConversation().id },
      direction: 'outgoing',
    })}
  </>
);
const renderSingleBothDirections = (props: Props) => (
  <>
    <Message {...props} />
    <Message
      {...{
        ...props,
        author: { ...props.author, id: getDefaultConversation().id },
        direction: 'outgoing',
      }}
    />
  </>
);

story.add('Plain Message', () => {
  const props = createProps({
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderBothDirections(props);
});

story.add('Plain RTL Message', () => {
  const props = createProps({
    text: 'الأسانسير، علشان القطط ماتاكلش منها. وننساها، ونعود الى أوراقنا موصدين الباب بإحكام. نتنحنح، ونقول: البتاع. كلمة تدلّ على لا شيء، وعلى كلّ شيء. وهي مركز أبحاث شعبية كثيرة، تتعجّب من غرابتها والقومية المصرية الخاصة التي تعكسها، الى جانب الشيء الكثير من العفوية وحلاوة الروح. نعم، نحن قرأنا وسمعنا وعرفنا كل هذا. لكنه محلّ اهتمامنا اليوم لأسباب غير تلك الأسباب. كذلك، فإننا لعاقدون عزمنا على أن نتجاوز قضية الفصحى والعامية، وثنائية النخبة والرعاع، التي كثيراً ما ينحو نحوها الحديث عن الكلمة المذكورة. وفوق هذا كله، لسنا بصدد تفسير معاني "البتاع" كما تأتي في قصيدة الحاج أحمد فؤاد نجم، ولا التحذلق والتفذلك في الألغاز والأسرار المكنونة. هذا البتاع - أم هذه البت',
    textDirection: TextDirection.RightToLeft,
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

  return renderThree(props);
});

story.add('Read', () => {
  const props = createProps({
    direction: 'outgoing',
    status: 'read',
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderThree(props);
});

story.add('Sending', () => {
  const props = createProps({
    direction: 'outgoing',
    status: 'sending',
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderThree(props);
});

story.add('Expiring', () => {
  const props = createProps({
    expirationLength: 30 * 1000,
    expirationTimestamp: Date.now() + 30 * 1000,
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderBothDirections(props);
});

story.add('Will expire but still sending', () => {
  const props = createProps({
    status: 'sending',
    expirationLength: 30 * 1000,
    text: 'We always show the timer if a message has an expiration length, even if unread or still sending.',
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

  return renderSingleBothDirections(props);
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

  return renderSingleBothDirections(props);
});

story.add('Avatar in Group', () => {
  const props = createProps({
    author: getDefaultConversation({ avatarPath: pngUrl }),
    conversationType: 'group',
    status: 'sent',
    text: 'Hello it is me, the saxophone.',
  });

  return renderThree(props);
});

story.add('Badge in Group', () => {
  const props = createProps({
    conversationType: 'group',
    getPreferredBadge: () => getFakeBadge(),
    status: 'sent',
    text: 'Hello it is me, the saxophone.',
  });

  return renderThree(props);
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
  const propsSent = createProps({
    conversationType: 'direct',
    deletedForEveryone: true,
    status: 'sent',
  });
  const propsSending = createProps({
    conversationType: 'direct',
    deletedForEveryone: true,
    status: 'sending',
  });

  return (
    <>
      {renderBothDirections(propsSent)}
      {renderBothDirections(propsSending)}
    </>
  );
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

story.add('Deleted with error', () => {
  const propsPartialError = createProps({
    timestamp: Date.now() - 60 * 1000,
    canDeleteForEveryone: true,
    conversationType: 'group',
    deletedForEveryone: true,
    status: 'partial-sent',
    direction: 'outgoing',
  });
  const propsError = createProps({
    timestamp: Date.now() - 60 * 1000,
    canDeleteForEveryone: true,
    conversationType: 'group',
    deletedForEveryone: true,
    status: 'error',
    direction: 'outgoing',
  });

  return (
    <>
      {renderThree(propsPartialError)}
      {renderThree(propsError)}
    </>
  );
});

story.add('Can delete for everyone', () => {
  const props = createProps({
    status: 'read',
    text: 'I hope you get this.',
    canDeleteForEveryone: true,
    direction: 'outgoing',
  });

  return renderThree(props);
});

story.add('Error', () => {
  const props = createProps({
    status: 'error',
    canRetry: true,
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
  const darkImageProps = createProps({
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
  const lightImageProps = createProps({
    attachments: [
      fakeAttachment({
        url: pngUrl,
        fileName: 'the-sax.png',
        contentType: IMAGE_PNG,
        height: 240,
        width: 320,
      }),
    ],
    status: 'sent',
  });

  return (
    <>
      {renderBothDirections(darkImageProps)}
      {renderBothDirections(lightImageProps)}
    </>
  );
});

for (let i = 2; i <= 5; i += 1) {
  story.add(`Multiple Images x${i}`, () => {
    const props = createProps({
      attachments: [
        fakeAttachment({
          url: pngUrl,
          fileName: 'the-sax.png',
          contentType: IMAGE_PNG,
          height: 240,
          width: 320,
        }),
        fakeAttachment({
          url: pngUrl,
          fileName: 'the-sax.png',
          contentType: IMAGE_PNG,
          height: 240,
          width: 320,
        }),
        fakeAttachment({
          url: pngUrl,
          fileName: 'the-sax.png',
          contentType: IMAGE_PNG,
          height: 240,
          width: 320,
        }),
        fakeAttachment({
          url: pngUrl,
          fileName: 'the-sax.png',
          contentType: IMAGE_PNG,
          height: 240,
          width: 320,
        }),
        fakeAttachment({
          url: pngUrl,
          fileName: 'the-sax.png',
          contentType: IMAGE_PNG,
          height: 240,
          width: 320,
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

  return renderThree(props);
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
    canRetry: true,
    canRetryDeleteForEveryone: true,
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
    {renderThree({
      ...createProps({ text: 'Solid.' }),
      direction: 'outgoing',
      customColor: {
        start: { hue: 82, saturation: 35 },
      },
    })}
    <br style={{ clear: 'both' }} />
    {renderThree({
      ...createProps({ text: 'Gradient.' }),
      direction: 'outgoing',
      customColor: {
        deg: 192,
        start: { hue: 304, saturation: 85 },
        end: { hue: 231, saturation: 76 },
      },
    })}
  </>
));

story.add('Collapsing text-only DMs', () => {
  const them = getDefaultConversation();
  const me = getDefaultConversation({ isMe: true });

  return renderMany([
    createProps({
      author: them,
      text: 'One',
      timestamp: Date.now() - 5 * MINUTE,
    }),
    createProps({
      author: them,
      text: 'Two',
      timestamp: Date.now() - 4 * MINUTE,
    }),
    createProps({
      author: them,
      text: 'Three',
      timestamp: Date.now() - 3 * MINUTE,
    }),
    createProps({
      author: me,
      direction: 'outgoing',
      text: 'Four',
      timestamp: Date.now() - 2 * MINUTE,
    }),
    createProps({
      text: 'Five',
      author: me,
      timestamp: Date.now() - MINUTE,
      direction: 'outgoing',
    }),
    createProps({
      author: me,
      direction: 'outgoing',
      text: 'Six',
    }),
  ]);
});

story.add('Collapsing text-only group messages', () => {
  const author = getDefaultConversation();

  return renderMany([
    createProps({
      author,
      conversationType: 'group',
      text: 'One',
      timestamp: Date.now() - 2 * MINUTE,
    }),
    createProps({
      author,
      conversationType: 'group',
      text: 'Two',
      timestamp: Date.now() - MINUTE,
    }),
    createProps({
      author,
      conversationType: 'group',
      text: 'Three',
    }),
  ]);
});

story.add('Story reply', () => {
  const conversation = getDefaultConversation();

  return renderThree({
    ...createProps({ text: 'Wow!' }),
    storyReplyContext: {
      authorTitle: conversation.title,
      conversationColor: ConversationColors[0],
      isFromMe: false,
      rawAttachment: fakeAttachment({
        url: '/fixtures/snow.jpg',
        thumbnail: fakeThumbnail('/fixtures/snow.jpg'),
      }),
    },
  });
});

const fullContact = {
  avatar: {
    avatar: fakeAttachment({
      path: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
      contentType: IMAGE_GIF,
    }),
    isProfile: true,
  },
  email: [
    {
      value: 'jerjor@fakemail.com',
      type: ContactFormType.HOME,
    },
  ],
  name: {
    givenName: 'Jerry',
    familyName: 'Jordan',
    prefix: 'Dr.',
    suffix: 'Jr.',
    middleName: 'James',
    displayName: 'Jerry Jordan',
  },
  number: [
    {
      value: '555-444-2323',
      type: ContactFormType.HOME,
    },
  ],
};

story.add('EmbeddedContact: Full Contact', () => {
  const props = createProps({
    contact: fullContact,
  });
  return renderBothDirections(props);
});

story.add('EmbeddedContact: with Send Message', () => {
  const props = createProps({
    contact: {
      ...fullContact,
      firstNumber: fullContact.number[0].value,
      uuid: UUID.generate().toString(),
    },
    direction: 'incoming',
  });
  return renderBothDirections(props);
});

story.add('EmbeddedContact: Only Email', () => {
  const props = createProps({
    contact: {
      email: fullContact.email,
    },
  });

  return renderBothDirections(props);
});

story.add('EmbeddedContact: Given Name', () => {
  const props = createProps({
    contact: {
      name: {
        givenName: 'Jerry',
      },
    },
  });

  return renderBothDirections(props);
});

story.add('EmbeddedContact: Organization', () => {
  const props = createProps({
    contact: {
      organization: 'Company 5',
    },
  });

  return renderBothDirections(props);
});

story.add('EmbeddedContact: Given + Family Name', () => {
  const props = createProps({
    contact: {
      name: {
        givenName: 'Jerry',
        familyName: 'FamilyName',
      },
    },
  });

  return renderBothDirections(props);
});

story.add('EmbeddedContact: Family Name', () => {
  const props = createProps({
    contact: {
      name: {
        familyName: 'FamilyName',
      },
    },
  });

  return renderBothDirections(props);
});

story.add('EmbeddedContact: Loading Avatar', () => {
  const props = createProps({
    contact: {
      name: {
        displayName: 'Jerry Jordan',
      },
      avatar: {
        avatar: fakeAttachment({
          pending: true,
          contentType: IMAGE_GIF,
        }),
        isProfile: true,
      },
    },
  });
  return renderBothDirections(props);
});
