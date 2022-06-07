// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean } from 'lodash';

import { action } from '@storybook/addon-actions';
import { boolean, number, select, text } from '@storybook/addon-knobs';

import { SignalService } from '../../protobuf';
import { ConversationColors } from '../../types/Colors';
import { EmojiPicker } from '../emoji/EmojiPicker';
import type { Props, AudioAttachmentProps } from './Message';
import { GiftBadgeStates, Message, TextDirection } from './Message';
import {
  AUDIO_MP3,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
  VIDEO_MP4,
  LONG_MESSAGE,
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
import { DAY, HOUR, MINUTE, SECOND } from '../../util/durations';
import { ContactFormType } from '../../types/EmbeddedContact';

import {
  fakeAttachment,
  fakeThumbnail,
} from '../../test-both/helpers/fakeAttachment';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';
import { UUID } from '../../types/UUID';
import { BadgeCategory } from '../../badges/BadgeCategory';

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

export default {
  title: 'Components/Conversation/Message',
};

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
  conversationTitle:
    overrideProps.conversationTitle ||
    text('conversationTitle', 'Conversation Title'),
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
  giftBadge: overrideProps.giftBadge,
  i18n,
  id: text('id', overrideProps.id || 'random-message-id'),
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
  openGiftBadge: action('openGiftBadge'),
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
  textAttachment: overrideProps.textAttachment || {
    contentType: LONG_MESSAGE,
    size: 123,
    pending: boolean('textPending', false),
  },
  theme: ThemeType.light,
  timestamp: number('timestamp', overrideProps.timestamp || Date.now()),
});

const createTimelineItem = (data: undefined | Props) =>
  data && {
    type: 'message' as const,
    data,
    timestamp: data.timestamp,
  };

const renderMany = (propsArray: ReadonlyArray<Props>) => (
  <>
    {propsArray.map((message, index) => (
      <Message
        key={message.text}
        {...message}
        shouldCollapseAbove={Boolean(propsArray[index - 1])}
        item={createTimelineItem(message)}
        shouldCollapseBelow={Boolean(propsArray[index + 1])}
      />
    ))}
  </>
);

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

export const PlainMessage = (): JSX.Element => {
  const props = createProps({
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderBothDirections(props);
};

export const PlainRtlMessage = (): JSX.Element => {
  const props = createProps({
    text: 'الأسانسير، علشان القطط ماتاكلش منها. وننساها، ونعود الى أوراقنا موصدين الباب بإحكام. نتنحنح، ونقول: البتاع. كلمة تدلّ على لا شيء، وعلى كلّ شيء. وهي مركز أبحاث شعبية كثيرة، تتعجّب من غرابتها والقومية المصرية الخاصة التي تعكسها، الى جانب الشيء الكثير من العفوية وحلاوة الروح. نعم، نحن قرأنا وسمعنا وعرفنا كل هذا. لكنه محلّ اهتمامنا اليوم لأسباب غير تلك الأسباب. كذلك، فإننا لعاقدون عزمنا على أن نتجاوز قضية الفصحى والعامية، وثنائية النخبة والرعاع، التي كثيراً ما ينحو نحوها الحديث عن الكلمة المذكورة. وفوق هذا كله، لسنا بصدد تفسير معاني "البتاع" كما تأتي في قصيدة الحاج أحمد فؤاد نجم، ولا التحذلق والتفذلك في الألغاز والأسرار المكنونة. هذا البتاع - أم هذه البت',
    textDirection: TextDirection.RightToLeft,
  });

  return renderBothDirections(props);
};

PlainRtlMessage.story = {
  name: 'Plain RTL Message',
};

export const EmojiMessages = (): JSX.Element => (
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
);

export const Delivered = (): JSX.Element => {
  const props = createProps({
    direction: 'outgoing',
    status: 'delivered',
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderThree(props);
};

export const _Read = (): JSX.Element => {
  const props = createProps({
    direction: 'outgoing',
    status: 'read',
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderThree(props);
};

export const Sending = (): JSX.Element => {
  const props = createProps({
    direction: 'outgoing',
    status: 'sending',
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderThree(props);
};

export const Expiring = (): JSX.Element => {
  const props = createProps({
    expirationLength: 30 * 1000,
    expirationTimestamp: Date.now() + 30 * 1000,
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  });

  return renderBothDirections(props);
};

export const WillExpireButStillSending = (): JSX.Element => {
  const props = createProps({
    status: 'sending',
    expirationLength: 30 * 1000,
    text: 'We always show the timer if a message has an expiration length, even if unread or still sending.',
  });

  return renderBothDirections(props);
};

WillExpireButStillSending.story = {
  name: 'Will expire but still sending',
};

export const Pending = (): JSX.Element => {
  const props = createProps({
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
    textAttachment: {
      contentType: LONG_MESSAGE,
      size: 123,
      pending: true,
    },
  });

  return renderBothDirections(props);
};

export const LongBodyCanBeDownloaded = (): JSX.Element => {
  const props = createProps({
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
    textAttachment: {
      contentType: LONG_MESSAGE,
      size: 123,
      pending: false,
      error: true,
      digest: 'abc',
      key: 'def',
    },
  });

  return renderBothDirections(props);
};

LongBodyCanBeDownloaded.story = {
  name: 'Long body can be downloaded',
};

export const Recent = (): JSX.Element => {
  const props = createProps({
    text: 'Hello there from a pal!',
    timestamp: Date.now() - 30 * 60 * 1000,
  });

  return renderBothDirections(props);
};

export const Older = (): JSX.Element => {
  const props = createProps({
    text: 'Hello there from a pal!',
    timestamp: Date.now() - 180 * 24 * 60 * 60 * 1000,
  });

  return renderBothDirections(props);
};

export const ReactionsWiderMessage = (): JSX.Element => {
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
};

ReactionsWiderMessage.story = {
  name: 'Reactions (wider message)',
};

const joyReactions = Array.from({ length: 52 }, () => getJoyReaction());

export const ReactionsShortMessage = (): JSX.Element => {
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
};

ReactionsShortMessage.story = {
  name: 'Reactions (short message)',
};

export const AvatarInGroup = (): JSX.Element => {
  const props = createProps({
    author: getDefaultConversation({ avatarPath: pngUrl }),
    conversationType: 'group',
    status: 'sent',
    text: 'Hello it is me, the saxophone.',
  });

  return renderThree(props);
};

AvatarInGroup.story = {
  name: 'Avatar in Group',
};

export const BadgeInGroup = (): JSX.Element => {
  const props = createProps({
    conversationType: 'group',
    getPreferredBadge: () => getFakeBadge(),
    status: 'sent',
    text: 'Hello it is me, the saxophone.',
  });

  return renderThree(props);
};

BadgeInGroup.story = {
  name: 'Badge in Group',
};

export const Sticker = (): JSX.Element => {
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
};

export const Deleted = (): JSX.Element => {
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
};

export const DeletedWithExpireTimer = (): JSX.Element => {
  const props = createProps({
    timestamp: Date.now() - 60 * 1000,
    conversationType: 'group',
    deletedForEveryone: true,
    expirationLength: 5 * 60 * 1000,
    expirationTimestamp: Date.now() + 3 * 60 * 1000,
    status: 'sent',
  });

  return renderBothDirections(props);
};

DeletedWithExpireTimer.story = {
  name: 'Deleted with expireTimer',
};

export const DeletedWithError = (): JSX.Element => {
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
};

DeletedWithError.story = {
  name: 'Deleted with error',
};

export const CanDeleteForEveryone = (): JSX.Element => {
  const props = createProps({
    status: 'read',
    text: 'I hope you get this.',
    canDeleteForEveryone: true,
    direction: 'outgoing',
  });

  return renderThree(props);
};

CanDeleteForEveryone.story = {
  name: 'Can delete for everyone',
};

export const Error = (): JSX.Element => {
  const props = createProps({
    status: 'error',
    canRetry: true,
    text: 'I hope you get this.',
  });

  return renderBothDirections(props);
};

export const Paused = (): JSX.Element => {
  const props = createProps({
    status: 'paused',
    text: 'I am up to a challenge',
  });

  return renderBothDirections(props);
};

export const PartialSend = (): JSX.Element => {
  const props = createProps({
    status: 'partial-sent',
    text: 'I hope you get this.',
  });

  return renderBothDirections(props);
};

export const LinkPreview = (): JSX.Element => {
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
};

export const LinkPreviewWithSmallImage = (): JSX.Element => {
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
};

LinkPreviewWithSmallImage.story = {
  name: 'Link Preview with Small Image',
};

export const LinkPreviewWithoutImage = (): JSX.Element => {
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
};

LinkPreviewWithoutImage.story = {
  name: 'Link Preview without Image',
};

export const LinkPreviewWithNoDescription = (): JSX.Element => {
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
};

LinkPreviewWithNoDescription.story = {
  name: 'Link Preview with no description',
};

export const LinkPreviewWithLongDescription = (): JSX.Element => {
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
};

LinkPreviewWithLongDescription.story = {
  name: 'Link Preview with long description',
};

export const LinkPreviewWithSmallImageLongDescription = (): JSX.Element => {
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
};

LinkPreviewWithSmallImageLongDescription.story = {
  name: 'Link Preview with small image, long description',
};

export const LinkPreviewWithNoDate = (): JSX.Element => {
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
};

LinkPreviewWithNoDate.story = {
  name: 'Link Preview with no date',
};

export const LinkPreviewWithTooNewADate = (): JSX.Element => {
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
};

LinkPreviewWithTooNewADate.story = {
  name: 'Link Preview with too new a date',
};

export const Image = (): JSX.Element => {
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
};

export const MultipleImages2 = (): JSX.Element => {
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
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
};

export const MultipleImages3 = (): JSX.Element => {
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
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
};

export const MultipleImages4 = (): JSX.Element => {
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
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
};

export const MultipleImages5 = (): JSX.Element => {
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
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
};

export const ImageWithCaption = (): JSX.Element => {
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
};

ImageWithCaption.story = {
  name: 'Image with Caption',
};

export const Gif = (): JSX.Element => {
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
};

Gif.story = {
  name: 'GIF',
};

export const GifInAGroup = (): JSX.Element => {
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
};

GifInAGroup.story = {
  name: 'GIF in a group',
};

export const NotDownloadedGif = (): JSX.Element => {
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
};

NotDownloadedGif.story = {
  name: 'Not Downloaded GIF',
};

export const PendingGif = (): JSX.Element => {
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
};

PendingGif.story = {
  name: 'Pending GIF',
};

export const _Audio = (): JSX.Element => {
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
};

export const LongAudio = (): JSX.Element => {
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
};

export const AudioWithCaption = (): JSX.Element => {
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
};

AudioWithCaption.story = {
  name: 'Audio with Caption',
};

export const AudioWithNotDownloadedAttachment = (): JSX.Element => {
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
};

AudioWithNotDownloadedAttachment.story = {
  name: 'Audio with Not Downloaded Attachment',
};

export const AudioWithPendingAttachment = (): JSX.Element => {
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
};

AudioWithPendingAttachment.story = {
  name: 'Audio with Pending Attachment',
};

export const OtherFileType = (): JSX.Element => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: stringToMIMEType('text/plain'),
        fileName: 'my-resume.txt',
        url: 'my-resume.txt',
        fileSize: '10MB',
      }),
    ],
    status: 'sent',
  });

  return renderBothDirections(props);
};

export const OtherFileTypeWithCaption = (): JSX.Element => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: stringToMIMEType('text/plain'),
        fileName: 'my-resume.txt',
        url: 'my-resume.txt',
        fileSize: '10MB',
      }),
    ],
    status: 'sent',
    text: 'This is what I have done.',
  });

  return renderBothDirections(props);
};

OtherFileTypeWithCaption.story = {
  name: 'Other File Type with Caption',
};

export const OtherFileTypeWithLongFilename = (): JSX.Element => {
  const props = createProps({
    attachments: [
      fakeAttachment({
        contentType: stringToMIMEType('text/plain'),
        fileName:
          'INSERT-APP-NAME_INSERT-APP-APPLE-ID_AppStore_AppsGamesWatch.psd.zip',
        url: 'a2/a2334324darewer4234',
        fileSize: '10MB',
      }),
    ],
    status: 'sent',
    text: 'This is what I have done.',
  });

  return renderBothDirections(props);
};

OtherFileTypeWithLongFilename.story = {
  name: 'Other File Type with Long Filename',
};

export const TapToViewImage = (): JSX.Element => {
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
};

TapToViewImage.story = {
  name: 'TapToView Image',
};

export const TapToViewVideo = (): JSX.Element => {
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
};

TapToViewVideo.story = {
  name: 'TapToView Video',
};

export const TapToViewGif = (): JSX.Element => {
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
};

TapToViewGif.story = {
  name: 'TapToView GIF',
};

export const TapToViewExpired = (): JSX.Element => {
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
};

TapToViewExpired.story = {
  name: 'TapToView Expired',
};

export const TapToViewError = (): JSX.Element => {
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
};

TapToViewError.story = {
  name: 'TapToView Error',
};

export const DangerousFileType = (): JSX.Element => {
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
};

export const Colors = (): JSX.Element => {
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
};

export const Mentions = (): JSX.Element => {
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
};

Mentions.story = {
  name: '@Mentions',
};

export const AllTheContextMenus = (): JSX.Element => {
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
};

AllTheContextMenus.story = {
  name: 'All the context menus',
};

export const NotApprovedWithLinkPreview = (): JSX.Element => {
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
};

NotApprovedWithLinkPreview.story = {
  name: 'Not approved, with link preview',
};

export const CustomColor = (): JSX.Element => (
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
);

export const CollapsingTextOnlyDMs = (): JSX.Element => {
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
};

CollapsingTextOnlyDMs.story = {
  name: 'Collapsing text-only DMs',
};

export const CollapsingTextOnlyGroupMessages = (): JSX.Element => {
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
};

CollapsingTextOnlyGroupMessages.story = {
  name: 'Collapsing text-only group messages',
};

export const StoryReply = (): JSX.Element => {
  const conversation = getDefaultConversation();

  return renderThree({
    ...createProps({ direction: 'outgoing', text: 'Wow!' }),
    storyReplyContext: {
      authorTitle: conversation.firstName || conversation.title,
      conversationColor: ConversationColors[0],
      isFromMe: false,
      rawAttachment: fakeAttachment({
        url: '/fixtures/snow.jpg',
        thumbnail: fakeThumbnail('/fixtures/snow.jpg'),
      }),
      text: 'Photo',
    },
  });
};

StoryReply.story = {
  name: 'Story reply',
};

export const StoryReplyYours = (): JSX.Element => {
  const conversation = getDefaultConversation();

  return renderThree({
    ...createProps({ direction: 'incoming', text: 'Wow!' }),
    storyReplyContext: {
      authorTitle: conversation.firstName || conversation.title,
      conversationColor: ConversationColors[0],
      isFromMe: true,
      rawAttachment: fakeAttachment({
        url: '/fixtures/snow.jpg',
        thumbnail: fakeThumbnail('/fixtures/snow.jpg'),
      }),
      text: 'Photo',
    },
  });
};

StoryReplyYours.story = {
  name: 'Story reply (yours)',
};

export const StoryReplyEmoji = (): JSX.Element => {
  const conversation = getDefaultConversation();

  return renderThree({
    ...createProps({ direction: 'outgoing', text: 'Wow!' }),
    storyReplyContext: {
      authorTitle: conversation.firstName || conversation.title,
      conversationColor: ConversationColors[0],
      emoji: '💄',
      isFromMe: false,
      rawAttachment: fakeAttachment({
        url: '/fixtures/snow.jpg',
        thumbnail: fakeThumbnail('/fixtures/snow.jpg'),
      }),
      text: 'Photo',
    },
  });
};

StoryReplyEmoji.story = {
  name: 'Story reply (emoji)',
};

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

export const EmbeddedContactFullContact = (): JSX.Element => {
  const props = createProps({
    contact: fullContact,
  });
  return renderBothDirections(props);
};

EmbeddedContactFullContact.story = {
  name: 'EmbeddedContact: Full Contact',
};

export const EmbeddedContactWithSendMessage = (): JSX.Element => {
  const props = createProps({
    contact: {
      ...fullContact,
      firstNumber: fullContact.number[0].value,
      uuid: UUID.generate().toString(),
    },
    direction: 'incoming',
  });
  return renderBothDirections(props);
};

EmbeddedContactWithSendMessage.story = {
  name: 'EmbeddedContact: with Send Message',
};

export const EmbeddedContactOnlyEmail = (): JSX.Element => {
  const props = createProps({
    contact: {
      email: fullContact.email,
    },
  });

  return renderBothDirections(props);
};

EmbeddedContactOnlyEmail.story = {
  name: 'EmbeddedContact: Only Email',
};

export const EmbeddedContactGivenName = (): JSX.Element => {
  const props = createProps({
    contact: {
      name: {
        givenName: 'Jerry',
      },
    },
  });

  return renderBothDirections(props);
};

EmbeddedContactGivenName.story = {
  name: 'EmbeddedContact: Given Name',
};

export const EmbeddedContactOrganization = (): JSX.Element => {
  const props = createProps({
    contact: {
      organization: 'Company 5',
    },
  });

  return renderBothDirections(props);
};

EmbeddedContactOrganization.story = {
  name: 'EmbeddedContact: Organization',
};

export const EmbeddedContactGivenFamilyName = (): JSX.Element => {
  const props = createProps({
    contact: {
      name: {
        givenName: 'Jerry',
        familyName: 'FamilyName',
      },
    },
  });

  return renderBothDirections(props);
};

EmbeddedContactGivenFamilyName.story = {
  name: 'EmbeddedContact: Given + Family Name',
};

export const EmbeddedContactFamilyName = (): JSX.Element => {
  const props = createProps({
    contact: {
      name: {
        familyName: 'FamilyName',
      },
    },
  });

  return renderBothDirections(props);
};

EmbeddedContactFamilyName.story = {
  name: 'EmbeddedContact: Family Name',
};

export const EmbeddedContactLoadingAvatar = (): JSX.Element => {
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
};

EmbeddedContactLoadingAvatar.story = {
  name: 'EmbeddedContact: Loading Avatar',
};

export const GiftBadgeUnopened = (): JSX.Element => {
  const props = createProps({
    giftBadge: {
      id: 'GIFT',
      expiration: Date.now() + DAY * 30,
      level: 3,
      state: GiftBadgeStates.Unopened,
    },
  });
  return renderBothDirections(props);
};

GiftBadgeUnopened.story = {
  name: 'Gift Badge: Unopened',
};

const getPreferredBadge = () => ({
  category: BadgeCategory.Donor,
  descriptionTemplate: 'This is a description of the badge',
  id: 'GIFT',
  images: [
    {
      transparent: {
        localPath: '/fixtures/orange-heart.svg',
        url: 'http://someplace',
      },
    },
  ],
  name: 'heart',
});

export const GiftBadgeRedeemed30Days = (): JSX.Element => {
  const props = createProps({
    getPreferredBadge,
    giftBadge: {
      expiration: Date.now() + DAY * 30 + SECOND,
      id: 'GIFT',
      level: 3,
      state: GiftBadgeStates.Redeemed,
    },
  });
  return renderBothDirections(props);
};

GiftBadgeRedeemed30Days.story = {
  name: 'Gift Badge: Redeemed (30 days)',
};

export const GiftBadgeRedeemed24Hours = (): JSX.Element => {
  const props = createProps({
    getPreferredBadge,
    giftBadge: {
      expiration: Date.now() + DAY + SECOND,
      id: 'GIFT',
      level: 3,
      state: GiftBadgeStates.Redeemed,
    },
  });
  return renderBothDirections(props);
};

GiftBadgeRedeemed24Hours.story = {
  name: 'Gift Badge: Redeemed (24 hours)',
};

export const GiftBadgeOpened60Minutes = (): JSX.Element => {
  const props = createProps({
    getPreferredBadge,
    giftBadge: {
      expiration: Date.now() + HOUR + SECOND,
      id: 'GIFT',
      level: 3,
      state: GiftBadgeStates.Opened,
    },
  });
  return renderBothDirections(props);
};

GiftBadgeOpened60Minutes.story = {
  name: 'Gift Badge: Opened (60 minutes)',
};

export const GiftBadgeRedeemed1Minute = (): JSX.Element => {
  const props = createProps({
    getPreferredBadge,
    giftBadge: {
      expiration: Date.now() + MINUTE + SECOND,
      id: 'GIFT',
      level: 3,
      state: GiftBadgeStates.Redeemed,
    },
  });
  return renderBothDirections(props);
};

GiftBadgeRedeemed1Minute.story = {
  name: 'Gift Badge: Redeemed (1 minute)',
};

export const GiftBadgeOpenedExpired = (): JSX.Element => {
  const props = createProps({
    getPreferredBadge,
    giftBadge: {
      expiration: Date.now(),
      id: 'GIFT',
      level: 3,
      state: GiftBadgeStates.Opened,
    },
  });
  return renderBothDirections(props);
};

GiftBadgeOpenedExpired.story = {
  name: 'Gift Badge: Opened (expired)',
};

export const GiftBadgeMissingBadge = (): JSX.Element => {
  const props = createProps({
    getPreferredBadge: () => undefined,
    giftBadge: {
      expiration: Date.now() + MINUTE + SECOND,
      id: 'MISSING',
      level: 3,
      state: GiftBadgeStates.Redeemed,
    },
  });
  return renderBothDirections(props);
};

GiftBadgeMissingBadge.story = {
  name: 'Gift Badge: Missing Badge',
};
