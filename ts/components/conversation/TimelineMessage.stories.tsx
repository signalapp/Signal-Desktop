// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean, noop } from 'lodash';

import { action } from '@storybook/addon-actions';
import type { Meta, StoryFn } from '@storybook/react';

import { SignalService } from '../../protobuf';
import { ConversationColors } from '../../types/Colors';
import { EmojiPicker } from '../emoji/EmojiPicker';
import type { AudioAttachmentProps } from './Message';
import type { Props } from './TimelineMessage';
import { TimelineMessage } from './TimelineMessage';
import { GiftBadgeStates, TextDirection } from './Message';
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
import { computePeaks } from '../VoiceNotesPlaybackContext';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { pngUrl } from '../../storybook/Fixtures';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { WidthBreakpoint } from '../_util';
import { DAY, HOUR, MINUTE, SECOND } from '../../util/durations';
import { ContactFormType } from '../../types/EmbeddedContact';
import { generateAci } from '../../types/ServiceId';

import {
  fakeAttachment,
  fakeThumbnail,
} from '../../test-both/helpers/fakeAttachment';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';
import { BadgeCategory } from '../../badges/BadgeCategory';
import { PaymentEventKind } from '../../types/Payment';

const i18n = setupI18n('en', enMessages);

const quoteOptions = {
  none: undefined,
  basic: {
    conversationColor: ConversationColors[2],
    text: 'The quoted message',
    isFromMe: false,
    sentAt: Date.now(),
    authorId: 'some-id',
    authorTitle: 'Someone',
    referencedMessageNotFound: false,
    isViewOnce: false,
    isGiftBadge: false,
  },
};

export default {
  title: 'Components/Conversation/TimelineMessage',
  argTypes: {
    conversationType: {
      control: 'select',
      options: ['direct', 'group'],
    },
    quote: {
      control: 'select',
      mapping: quoteOptions,
      options: Object.keys(quoteOptions),
    },
  },
  args: {
    conversationType: 'direct',
    quote: undefined,
  },
} satisfies Meta<Props>;

const Template: StoryFn<Partial<Props>> = args => {
  return renderBothDirections({
    ...createProps(),
    conversationType: 'direct',
    quote: undefined,
    ...args,
  });
};

const messageIdToAudioUrl = {
  'incompetech-com-Agnus-Dei-X': '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
};

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
    wasInvokedFromKeyboard={false}
  />
);

const renderReactionPicker: Props['renderReactionPicker'] = () => <div />;

/**
 * It doesn't handle consecutive playback
 * since that logic mostly lives in the audioPlayer duck
 */
function MessageAudioContainer({
  played,
  ...props
}: AudioAttachmentProps): JSX.Element {
  const [isActive, setIsActive] = React.useState<boolean>(false);
  const [currentTime, setCurrentTime] = React.useState<number>(0);
  const [playbackRate, setPlaybackRate] = React.useState<number>(1);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [_played, setPlayed] = React.useState<boolean>(played);

  const audioPlayer = React.useMemo(() => {
    const a = new Audio();

    let onLoadedData: () => void = noop;

    a.addEventListener('timeupdate', () => {
      setCurrentTime(a.currentTime);
    });

    a.addEventListener('ended', () => {
      setIsActive(false);
    });

    a.addEventListener('loadeddata', () => onLoadedData());

    function play(positionAsRatio?: number) {
      if (positionAsRatio !== undefined) {
        a.currentTime = positionAsRatio * a.duration;
      }
      void a.play();
    }

    return {
      loadAndPlay(url: string, positionAsRatio: number) {
        onLoadedData = () => {
          play(positionAsRatio);
        };
        a.src = url;
      },
      play,
      pause() {
        a.pause();
      },
      set playbackRate(rate: number) {
        a.playbackRate = rate;
      },
      set currentTime(value: number) {
        a.currentTime = value;
      },
      get duration() {
        return a.duration;
      },
    };
  }, []);

  const handlePlayMessage = (id: string, positionAsRatio: number) => {
    if (!active) {
      audioPlayer.loadAndPlay(
        messageIdToAudioUrl[id as keyof typeof messageIdToAudioUrl],
        positionAsRatio
      );
      setIsActive(true);
      setIsPlaying(true);
      setPlayed(true);
    }
  };

  const setPlaybackRateAction = (rate: number) => {
    audioPlayer.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const setIsPlayingAction = (value: boolean) => {
    if (value) {
      audioPlayer.play();
    } else {
      audioPlayer.pause();
    }
    setIsPlaying(value);
  };

  const setPosition = (value: number) => {
    audioPlayer.currentTime = value * audioPlayer.duration;
    setCurrentTime(audioPlayer.currentTime);
  };

  const active = isActive
    ? {
        playing: isPlaying,
        playbackRate,
        currentTime,
        duration: audioPlayer.duration,
      }
    : undefined;

  return (
    <MessageAudio
      {...props}
      active={active}
      computePeaks={computePeaks}
      onPlayMessage={handlePlayMessage}
      played={_played}
      pushPanelForConversation={action('pushPanelForConversation')}
      setPosition={setPosition}
      setIsPlaying={setIsPlayingAction}
      setPlaybackRate={setPlaybackRateAction}
    />
  );
}

const renderAudioAttachment: Props['renderAudioAttachment'] = props => (
  <MessageAudioContainer {...props} />
);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  attachments: overrideProps.attachments,
  attachmentDroppedDueToSize: overrideProps.attachmentDroppedDueToSize || false,
  author: overrideProps.author || getDefaultConversation(),
  bodyRanges: overrideProps.bodyRanges,
  canCopy: true,
  canEditMessage: true,
  canReact: true,
  canReply: true,
  canDownload: true,
  canDeleteForEveryone: overrideProps.canDeleteForEveryone || false,
  canRetry: overrideProps.canRetry || false,
  canRetryDeleteForEveryone: overrideProps.canRetryDeleteForEveryone || false,
  checkForAccount: action('checkForAccount'),
  clearTargetedMessage: action('clearSelectedMessage'),
  containerElementRef: React.createRef<HTMLElement>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationColor: overrideProps.conversationColor ?? ConversationColors[0],
  conversationTitle: overrideProps.conversationTitle ?? 'Conversation Title',
  conversationId: overrideProps.conversationId ?? '',
  conversationType: overrideProps.conversationType || 'direct',
  contact: overrideProps.contact,
  deletedForEveryone: overrideProps.deletedForEveryone,
  // disableMenu: overrideProps.disableMenu,
  disableScroll: overrideProps.disableScroll,
  direction: overrideProps.direction || 'incoming',
  showLightboxForViewOnceMedia: action('showLightboxForViewOnceMedia'),
  doubleCheckMissingQuoteReference: action('doubleCheckMissingQuoteReference'),
  expirationLength: overrideProps.expirationLength ?? 0,
  expirationTimestamp: overrideProps.expirationTimestamp ?? 0,
  getPreferredBadge: overrideProps.getPreferredBadge || (() => undefined),
  giftBadge: overrideProps.giftBadge,
  i18n,
  platform: 'darwin',
  id: overrideProps.id ?? 'random-message-id',
  // renderingContext: 'storybook',
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
  isSelected: isBoolean(overrideProps.isSelected)
    ? overrideProps.isSelected
    : false,
  isSelectMode: isBoolean(overrideProps.isSelectMode)
    ? overrideProps.isSelectMode
    : false,
  isSMS: isBoolean(overrideProps.isSMS) ? overrideProps.isSMS : false,
  isSpoilerExpanded: overrideProps.isSpoilerExpanded || {},
  isTapToView: overrideProps.isTapToView,
  isTapToViewError: overrideProps.isTapToViewError,
  isTapToViewExpired: overrideProps.isTapToViewExpired,
  cancelAttachmentDownload: action('cancelAttachmentDownload'),
  kickOffAttachmentDownload: action('kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('markAttachmentAsCorrupted'),
  messageExpanded: action('messageExpanded'),
  showConversation: action('showConversation'),
  openGiftBadge: action('openGiftBadge'),
  previews: overrideProps.previews || [],
  quote: overrideProps.quote || undefined,
  reactions: overrideProps.reactions,
  reactToMessage: action('reactToMessage'),
  readStatus:
    overrideProps.readStatus === undefined
      ? ReadStatus.Read
      : overrideProps.readStatus,
  renderEmojiPicker,
  renderReactionPicker,
  renderAudioAttachment,
  saveAttachment: action('saveAttachment'),
  saveAttachments: action('saveAttachments'),
  setQuoteByMessageId: action('setQuoteByMessageId'),
  retryMessageSend: action('retryMessageSend'),
  copyMessageText: action('copyMessageText'),
  retryDeleteForEveryone: action('retryDeleteForEveryone'),
  scrollToQuotedMessage: action('scrollToQuotedMessage'),
  targetMessage: action('targetMessage'),
  toggleSelectMessage:
    overrideProps.toggleSelectMessage == null
      ? action('toggleSelectMessage')
      : overrideProps.toggleSelectMessage,
  setMessageToEdit: action('setMessageToEdit'),
  shouldCollapseAbove: isBoolean(overrideProps.shouldCollapseAbove)
    ? overrideProps.shouldCollapseAbove
    : false,
  shouldCollapseBelow: isBoolean(overrideProps.shouldCollapseBelow)
    ? overrideProps.shouldCollapseBelow
    : false,
  shouldHideMetadata: isBoolean(overrideProps.shouldHideMetadata)
    ? overrideProps.shouldHideMetadata
    : false,
  showSpoiler: action('showSpoiler'),
  pushPanelForConversation: action('pushPanelForConversation'),
  showContactModal: action('showContactModal'),
  showAttachmentDownloadStillInProgressToast: action(
    'showAttachmentDownloadStillInProgressToast'
  ),
  showAttachmentNotAvailableModal: action('showAttachmentNotAvailableModal'),
  showExpiredIncomingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showExpiredOutgoingTapToViewToast: action(
    'showExpiredOutgoingTapToViewToast'
  ),
  showMediaNoLongerAvailableToast: action('showMediaNoLongerAvailableToast'),
  toggleDeleteMessagesModal: action('toggleDeleteMessagesModal'),
  toggleForwardMessagesModal: action('toggleForwardMessagesModal'),
  showLightbox: action('showLightbox'),
  startConversation: action('startConversation'),
  status: overrideProps.status || 'sent',
  text: overrideProps.text ?? '',
  textDirection: overrideProps.textDirection || TextDirection.Default,
  textAttachment: overrideProps.textAttachment || {
    contentType: LONG_MESSAGE,
    size: 123,
    pending: false,
  },
  theme: ThemeType.light,
  timestamp: overrideProps.timestamp ?? Date.now(),
  viewStory: action('viewStory'),
});

const renderMany = (propsArray: ReadonlyArray<Props>) => (
  <>
    {propsArray.map((message, index) => (
      <TimelineMessage
        key={message.text}
        {...message}
        shouldCollapseAbove={Boolean(propsArray[index - 1])}
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

export const PlainMessage = Template.bind({});
PlainMessage.args = {
  text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
};

export const PlainRtlMessage = Template.bind({});
PlainRtlMessage.args = {
  text: 'الأسانسير، علشان القطط ماتاكلش منها. وننساها، ونعود الى أوراقنا موصدين الباب بإحكام. نتنحنح، ونقول: البتاع. كلمة تدلّ على لا شيء، وعلى كلّ شيء. وهي مركز أبحاث شعبية كثيرة، تتعجّب من غرابتها والقومية المصرية الخاصة التي تعكسها، الى جانب الشيء الكثير من العفوية وحلاوة الروح. نعم، نحن قرأنا وسمعنا وعرفنا كل هذا. لكنه محلّ اهتمامنا اليوم لأسباب غير تلك الأسباب. كذلك، فإننا لعاقدون عزمنا على أن نتجاوز قضية الفصحى والعامية، وثنائية النخبة والرعاع، التي كثيراً ما ينحو نحوها الحديث عن الكلمة المذكورة. وفوق هذا كله، لسنا بصدد تفسير معاني "البتاع" كما تأتي في قصيدة الحاج أحمد فؤاد نجم، ولا التحذلق والتفذلك في الألغاز والأسرار المكنونة. هذا البتاع - أم هذه البت',
  textDirection: TextDirection.RightToLeft,
};

export function EmojiMessages(): JSX.Element {
  return (
    <>
      <TimelineMessage {...createProps({ text: '😀' })} />
      <br />
      <TimelineMessage {...createProps({ text: '😀😀' })} />
      <br />
      <TimelineMessage {...createProps({ text: '😀😀😀' })} />
      <br />
      <TimelineMessage {...createProps({ text: '😀😀😀😀' })} />
      <br />
      <TimelineMessage {...createProps({ text: '😀😀😀😀😀' })} />
      <br />
      <TimelineMessage {...createProps({ text: '😀😀😀😀😀😀😀' })} />
      <br />
      <TimelineMessage
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
              isCallLink: false,
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
      <TimelineMessage
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
      <TimelineMessage
        {...createProps({
          id: 'incompetech-com-Agnus-Dei-X',
          attachments: [
            fakeAttachment({
              contentType: AUDIO_MP3,
              fileName: 'incompetech-com-Agnus-Dei-X.mp3',
              url: messageIdToAudioUrl['incompetech-com-Agnus-Dei-X'],
            }),
          ],
          text: '😀',
        })}
      />
      <br />
      <TimelineMessage
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
      <TimelineMessage
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
}

export const Delivered = Template.bind({});
Delivered.args = {
  status: 'delivered',
  text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
};

export const Read = Template.bind({});
Read.args = {
  status: 'read',
  text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
};

export const Sending = Template.bind({});
Sending.args = {
  status: 'sending',
  text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
};

export const Expiring = Template.bind({});
Expiring.args = {
  expirationLength: 30 * 1000,
  expirationTimestamp: Date.now() + 30 * 1000,
  text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
};

export const WillExpireButStillSending = Template.bind({});
WillExpireButStillSending.args = {
  status: 'sending',
  expirationLength: 30 * 1000,
  text: 'We always show the timer if a message has an expiration length, even if unread or still sending.',
};

export const Pending = Template.bind({});
Pending.args = {
  text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  textAttachment: {
    contentType: LONG_MESSAGE,
    size: 123,
    pending: true,
  },
};

export const LongBodyCanBeDownloaded = Template.bind({});
LongBodyCanBeDownloaded.args = {
  text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
  textAttachment: {
    contentType: LONG_MESSAGE,
    size: 123,
    pending: false,
    error: true,
    digest: 'abc',
    key: 'def',
  },
};

export const Recent = Template.bind({});
Recent.args = {
  text: 'Hello there from a pal!',
  timestamp: Date.now() - 30 * 60 * 1000,
};

export const Older = Template.bind({});
Older.args = {
  text: 'Hello there from a pal!',
  timestamp: Date.now() - 180 * 24 * 60 * 60 * 1000,
};

export const ReactionsWiderMessage = Template.bind({});
ReactionsWiderMessage.args = {
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
};

const joyReactions = Array.from({ length: 52 }, () => getJoyReaction());

export const ReactionsShortMessage = Template.bind({});
ReactionsShortMessage.args = {
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
};

export const AvatarInGroup = Template.bind({});
AvatarInGroup.args = {
  author: getDefaultConversation({ avatarUrl: pngUrl }),
  conversationType: 'group',
  status: 'sent',
  text: 'Hello it is me, the saxophone.',
};

export const BadgeInGroup = Template.bind({});
BadgeInGroup.args = {
  conversationType: 'group',
  getPreferredBadge: () => getFakeBadge(),
  status: 'sent',
  text: 'Hello it is me, the saxophone.',
};

export const Sticker = Template.bind({});
Sticker.args = {
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
};

export const Quote = Template.bind({});
Quote.args = {
  quote: {
    text: 'hello my good friend',
    conversationColor: 'ultramarine',
    conversationTitle: 'Convo',
    isFromMe: false,
    sentAt: 0,
    authorId: '',
    authorTitle: 'Author',
    referencedMessageNotFound: false,
    isViewOnce: false,
    isGiftBadge: false,
  },
  author: {
    id: '',
    isMe: false,
    title: 'Quoter Dude',
    sharedGroupNames: [],
    acceptedMessageRequest: true,
    badges: [],
  },
  conversationType: 'group',
};

export function Deleted(): JSX.Element {
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
}

export const DeletedWithExpireTimer = Template.bind({});
DeletedWithExpireTimer.args = {
  timestamp: Date.now() - 60 * 1000,
  conversationType: 'group',
  deletedForEveryone: true,
  expirationLength: 5 * 60 * 1000,
  expirationTimestamp: Date.now() + 3 * 60 * 1000,
  status: 'sent',
};

export function DeletedWithError(): JSX.Element {
  const propsPartialError = createProps({
    timestamp: Date.now() - 60 * 1000,
    // canDeleteForEveryone: true,
    conversationType: 'group',
    deletedForEveryone: true,
    status: 'partial-sent',
    direction: 'outgoing',
  });
  const propsError = createProps({
    timestamp: Date.now() - 60 * 1000,
    // canDeleteForEveryone: true,
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
}

export const CanDeleteForEveryone = Template.bind({});
CanDeleteForEveryone.args = {
  status: 'read',
  text: 'I hope you get this.',
  // canDeleteForEveryone: true,
  direction: 'outgoing',
};

const bigAttachment = {
  contentType: stringToMIMEType('text/plain'),
  fileName: 'why-i-love-birds.txt',
  size: 100000000000,
  width: undefined,
  height: undefined,
  path: undefined,
  key: undefined,
  id: undefined,
  error: true,
  wasTooBig: true,
};

export function AttachmentTooBig(): JSX.Element {
  const propsSent = createProps({
    conversationType: 'direct',
    attachmentDroppedDueToSize: true,
    attachments: [bigAttachment],
  });

  return <>{renderBothDirections(propsSent)}</>;
}

export function AttachmentTooBigWithText(): JSX.Element {
  const propsSent = createProps({
    conversationType: 'direct',
    attachmentDroppedDueToSize: true,
    attachments: [bigAttachment],
    text: 'Check out this file!',
  });

  return <>{renderBothDirections(propsSent)}</>;
}

const bigImageAttachment = {
  ...bigAttachment,
  contentType: IMAGE_JPEG,
  fileName: 'bird.jpg',
  blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
  width: 1000,
  height: 1000,
};

export function AttachmentTooBigImage(): JSX.Element {
  const propsSent = createProps({
    conversationType: 'direct',
    attachmentDroppedDueToSize: true,
    attachments: [bigImageAttachment],
  });

  return <>{renderBothDirections(propsSent)}</>;
}

export function AttachmentTooBigImageWithText(): JSX.Element {
  const propsSent = createProps({
    conversationType: 'direct',
    attachmentDroppedDueToSize: true,
    attachments: [bigImageAttachment],
    text: 'Check out this file!',
  });

  return <>{renderBothDirections(propsSent)}</>;
}

export const Error = Template.bind({});
Error.args = {
  status: 'error',
  // canRetry: true,
  text: 'I hope you get this.',
};

export const EditError = Template.bind({});
EditError.args = {
  status: 'error',
  isEditedMessage: true,
  text: 'I hope you get this.',
};

export const Paused = Template.bind({});
Paused.args = {
  status: 'paused',
  text: 'I am up to a challenge',
};

export const PartialSend = Template.bind({});
PartialSend.args = {
  status: 'partial-sent',
  text: 'I hope you get this.',
};

export const LinkPreviewInGroup = Template.bind({});
LinkPreviewInGroup.args = {
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
      isCallLink: false,
      title: 'Signal',
      description:
        'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
      url: 'https://www.signal.org',
      date: new Date(2020, 2, 10).valueOf(),
    },
  ],
  status: 'sent',
  text: 'Be sure to look at https://www.signal.org',
  conversationType: 'group',
};

export const LinkPreviewWithLongWord = Template.bind({});
LinkPreviewWithLongWord.args = {
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
      isCallLink: false,
      title: 'Signal',
      description: `Say "hello" to a ${'Different'.repeat(10)} messaging experience.`,
      url: 'https://www.signal.org',
      date: new Date(2020, 2, 10).valueOf(),
    },
  ],
  status: 'sent',
  text: 'Be sure to look at https://www.signal.org',
  conversationType: 'group',
};

export const LinkPreviewWithQuote = Template.bind({});
LinkPreviewWithQuote.args = {
  quote: {
    conversationColor: ConversationColors[2],
    conversationTitle: getDefaultConversation().title,
    text: 'The quoted message',
    isFromMe: false,
    sentAt: Date.now(),
    authorId: 'some-id',
    authorTitle: 'Someone',
    referencedMessageNotFound: false,
    isViewOnce: false,
    isGiftBadge: false,
  },
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
      isCallLink: false,
      title: 'Signal',
      description:
        'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
      url: 'https://www.signal.org',
      date: new Date(2020, 2, 10).valueOf(),
    },
  ],
  status: 'sent',
  text: 'Be sure to look at https://www.signal.org',
  conversationType: 'group',
};

export const LinkPreviewWithSmallImage = Template.bind({});
LinkPreviewWithSmallImage.args = {
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
      isCallLink: false,
      title: 'Signal',
      description:
        'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
      url: 'https://www.signal.org',
      date: new Date(2020, 2, 10).valueOf(),
    },
  ],
  status: 'sent',
  text: 'Be sure to look at https://www.signal.org',
};

export const LinkPreviewWithoutImage = Template.bind({});
LinkPreviewWithoutImage.args = {
  previews: [
    {
      domain: 'signal.org',
      isStickerPack: false,
      isCallLink: false,
      title: 'Signal',
      description:
        'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
      url: 'https://www.signal.org',
      date: new Date(2020, 2, 10).valueOf(),
    },
  ],
  status: 'sent',
  text: 'Be sure to look at https://www.signal.org',
};

export const LinkPreviewWithNoDescription = Template.bind({});
LinkPreviewWithNoDescription.args = {
  previews: [
    {
      domain: 'signal.org',
      isStickerPack: false,
      isCallLink: false,
      title: 'Signal',
      url: 'https://www.signal.org',
      date: Date.now(),
    },
  ],
  status: 'sent',
  text: 'Be sure to look at https://www.signal.org',
};

export const LinkPreviewWithLongDescription = Template.bind({});
LinkPreviewWithLongDescription.args = {
  previews: [
    {
      domain: 'signal.org',
      isStickerPack: false,
      isCallLink: false,
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
};

export const LinkPreviewWithSmallImageLongDescription = Template.bind({});
LinkPreviewWithSmallImageLongDescription.args = {
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
      isCallLink: false,
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
};

export const LinkPreviewWithNoDate = Template.bind({});
LinkPreviewWithNoDate.args = {
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
      isCallLink: false,
      title: 'Signal',
      description:
        'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
      url: 'https://www.signal.org',
    },
  ],
  status: 'sent',
  text: 'Be sure to look at https://www.signal.org',
};

export const LinkPreviewWithTooNewADate = Template.bind({});
LinkPreviewWithTooNewADate.args = {
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
      isCallLink: false,
      title: 'Signal',
      description:
        'Say "hello" to a different messaging experience. An unexpected focus on privacy, combined with all of the features you expect.',
      url: 'https://www.signal.org',
      date: Date.now() + 3000000000,
    },
  ],
  status: 'sent',
  text: 'Be sure to look at https://www.signal.org',
};

export const LinkPreviewWithCallLink = Template.bind({});
LinkPreviewWithCallLink.args = {
  previews: [
    {
      url: 'https://signal.link/call/#key=hzcn-pcff-ctsc-bdbf-stcr-tzpc-bhqx-kghh',
      title: 'Camping Prep',
      description: 'Use this link to join a Signal call',
      image: undefined,
      date: undefined,
      isCallLink: true,
      isStickerPack: false,
    },
  ],
  status: 'sent',
  text: 'Use this link to join a Signal call: https://signal.link/call/#key=hzcn-pcff-ctsc-bdbf-stcr-tzpc-bhqx-kghh',
};

export const LinkPreviewWithCallLinkInAnotherCall = Template.bind({});
LinkPreviewWithCallLinkInAnotherCall.args = {
  previews: [
    {
      url: 'https://signal.link/call/#key=hzcn-pcff-ctsc-bdbf-stcr-tzpc-bhqx-kghh',
      title: 'Camping Prep',
      description: 'Use this link to join a Signal call',
      image: undefined,
      date: undefined,
      isCallLink: true,
      isStickerPack: false,
    },
  ],
  status: 'sent',
  activeCallConversationId: 'some-other-conversation',
  text: 'Use this link to join a Signal call: https://signal.link/call/#key=hzcn-pcff-ctsc-bdbf-stcr-tzpc-bhqx-kghh',
};

export const LinkPreviewWithCallLinkInCurrentCall = Template.bind({});
LinkPreviewWithCallLinkInCurrentCall.args = {
  previews: [
    {
      url: 'https://signal.link/call/#key=hzcn-pcff-ctsc-bdbf-stcr-tzpc-bhqx-kghh',
      domain: 'signal.link',
      title: 'Camping Prep',
      description: 'Use this link to join a Signal call',
      image: undefined,
      date: undefined,
      isCallLink: true,
      callLinkRoomId: 'room-id',
      isStickerPack: false,
    },
  ],
  conversationType: 'group',
  status: 'sent',
  activeCallConversationId: 'room-id',
  text: 'Use this link to join a Signal call: https://signal.link/call/#key=hzcn-pcff-ctsc-bdbf-stcr-tzpc-bhqx-kghh',
};

export function Image(): JSX.Element {
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
}

export const MultipleImages2 = Template.bind({});
MultipleImages2.args = {
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
};

export const MultipleImages3 = Template.bind({});
MultipleImages3.args = {
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
};

export const MultipleImages4 = Template.bind({});
MultipleImages4.args = {
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
};

export const MultipleImages5 = Template.bind({});
MultipleImages5.args = {
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
};

export const MultipleImagesWithOneTooBig = Template.bind({});
MultipleImagesWithOneTooBig.args = {
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
  attachmentDroppedDueToSize: true,
  status: 'sent',
};

export const MultipleImagesWithBodyTextOneTooBig = Template.bind({});
MultipleImagesWithBodyTextOneTooBig.args = {
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
  attachmentDroppedDueToSize: true,
  text: 'Hey, check out these images!',
  status: 'sent',
};

export const ImageWithCaption = Template.bind({});
ImageWithCaption.args = {
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
};

export const Gif = Template.bind({});
Gif.args = {
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
};

export const GifReducedMotion = Template.bind({});
GifReducedMotion.args = {
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
  _forceTapToPlay: true,
};

export const GifInAGroup = Template.bind({});
GifInAGroup.args = {
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
};

export const NotDownloadedGif = Template.bind({});
NotDownloadedGif.args = {
  attachments: [
    fakeAttachment({
      contentType: VIDEO_MP4,
      flags: SignalService.AttachmentPointer.Flags.GIF,
      fileName: 'cat-gif.mp4',
      blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      width: 400,
      height: 332,
      path: undefined,
    }),
  ],
  status: 'sent',
};

export const PendingGif = Template.bind({});
PendingGif.args = {
  attachments: [
    fakeAttachment({
      pending: true,
      contentType: VIDEO_MP4,
      flags: SignalService.AttachmentPointer.Flags.GIF,
      fileName: 'cat-gif.mp4',
      size: 188610,
      blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      width: 400,
      height: 332,
      path: undefined,
    }),
  ],
  status: 'sent',
};

export const DownloadingGif = Template.bind({});
DownloadingGif.args = {
  attachments: [
    fakeAttachment({
      pending: true,
      contentType: VIDEO_MP4,
      flags: SignalService.AttachmentPointer.Flags.GIF,
      fileName: 'cat-gif.mp4',
      size: 188610,
      totalDownloaded: 101010,
      blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      width: 400,
      height: 332,
      path: undefined,
    }),
  ],
  status: 'sent',
};

export const PartialDownloadNotPendingGif = Template.bind({});
PartialDownloadNotPendingGif.args = {
  attachments: [
    fakeAttachment({
      contentType: VIDEO_MP4,
      flags: SignalService.AttachmentPointer.Flags.GIF,
      fileName: 'cat-gif.mp4',
      size: 188610,
      totalDownloaded: 101010,
      blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      width: 400,
      height: 332,
      path: undefined,
    }),
  ],
  status: 'sent',
};

export const _Audio = (): JSX.Element => {
  function Wrapper() {
    const [isPlayed, setIsPlayed] = React.useState(false);

    const messageProps = createProps({
      id: 'incompetech-com-Agnus-Dei-X',
      attachments: [
        fakeAttachment({
          contentType: AUDIO_MP3,
          fileName: 'incompetech-com-Agnus-Dei-X.mp3',
          url: messageIdToAudioUrl['incompetech-com-Agnus-Dei-X'],
          path: 'somepath',
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
  }

  return <Wrapper />;
};

export const LongAudio = Template.bind({});
LongAudio.args = {
  attachments: [
    fakeAttachment({
      contentType: AUDIO_MP3,
      fileName: 'long-audio.mp3',
      url: '/fixtures/long-audio.mp3',
      path: 'somepath',
    }),
  ],
  status: 'sent',
};

export const AudioWithCaption = Template.bind({});
AudioWithCaption.args = {
  attachments: [
    fakeAttachment({
      contentType: AUDIO_MP3,
      fileName: 'incompetech-com-Agnus-Dei-X.mp3',
      url: '/fixtures/incompetech-com-Agnus-Dei-X.mp3',
      path: 'somepath',
    }),
  ],
  status: 'sent',
  text: 'This is what I sound like.',
};

export const AudioWithNotDownloadedAttachment = Template.bind({});
AudioWithNotDownloadedAttachment.args = {
  attachments: [
    fakeAttachment({
      contentType: AUDIO_MP3,
      fileName: 'incompetech-com-Agnus-Dei-X.mp3',
    }),
  ],
  status: 'sent',
};

export const AudioWithPendingAttachment = Template.bind({});
AudioWithPendingAttachment.args = {
  attachments: [
    fakeAttachment({
      contentType: AUDIO_MP3,
      fileName: 'incompetech-com-Agnus-Dei-X.mp3',
      pending: true,
    }),
  ],
  status: 'sent',
};

export const OtherFileType = Template.bind({});
OtherFileType.args = {
  attachments: [
    fakeAttachment({
      contentType: stringToMIMEType('text/plain'),
      fileName: 'my-resume.txt',
      url: 'my-resume.txt',
    }),
  ],
  status: 'sent',
};

export const OtherFileTypeWithCaption = Template.bind({});
OtherFileTypeWithCaption.args = {
  attachments: [
    fakeAttachment({
      contentType: stringToMIMEType('text/plain'),
      fileName: 'my-resume.txt',
      url: 'my-resume.txt',
    }),
  ],
  status: 'sent',
  text: 'This is what I have done.',
};

export const OtherFileTypeWithLongFilename = Template.bind({});
OtherFileTypeWithLongFilename.args = {
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
};

export const TapToViewImage = Template.bind({});
TapToViewImage.args = {
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
};

export const TapToViewVideo = Template.bind({});
TapToViewVideo.args = {
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
};

export const TapToViewGif = Template.bind({});
TapToViewGif.args = {
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
};

export const TapToViewExpired = Template.bind({});
TapToViewExpired.args = {
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
};

export const TapToViewError = Template.bind({});
TapToViewError.args = {
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
};

export const DangerousFileType = Template.bind({});
DangerousFileType.args = {
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
};

export function Colors(): JSX.Element {
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
}

export const Mentions = Template.bind({});
Mentions.args = {
  bodyRanges: [
    {
      start: 0,
      length: 1,
      mentionAci: generateAci(),
      replacementText: 'Zapp Brannigan',
      conversationID: 'x',
    },
  ],
  text: '\uFFFC This Is It. The Moment We Should Have Trained For.',
};

export function AllTheContextMenus(): JSX.Element {
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

  return <TimelineMessage {...props} direction="outgoing" />;
}

export const NotApprovedWithLinkPreview = Template.bind({});
NotApprovedWithLinkPreview.args = {
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
      isCallLink: false,
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
};

export function CustomColor(): JSX.Element {
  return (
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
}

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

export const StoryReplyEmoji = (): JSX.Element => {
  const conversation = getDefaultConversation();

  return renderBothDirections({
    ...createProps({ text: 'Wow!' }),
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
  },
  number: [
    {
      value: '555-444-2323',
      type: ContactFormType.HOME,
    },
  ],
};

export const EmbeddedContactFullContact = Template.bind({});
EmbeddedContactFullContact.args = {
  contact: fullContact,
};

export const EmbeddedContactWithSendMessage = Template.bind({});
EmbeddedContactWithSendMessage.args = {
  contact: {
    ...fullContact,
    firstNumber: fullContact.number[0].value,
    serviceId: generateAci(),
  },
  direction: 'incoming',
};

export const EmbeddedContactOnlyEmail = Template.bind({});
EmbeddedContactOnlyEmail.args = {
  contact: {
    email: fullContact.email,
  },
};

export const EmbeddedContactGivenName = Template.bind({});
EmbeddedContactGivenName.args = {
  contact: {
    name: {
      givenName: 'Jerry',
    },
  },
};

export const EmbeddedContactOrganization = Template.bind({});
EmbeddedContactOrganization.args = {
  contact: {
    organization: 'Company 5',
  },
};

export const EmbeddedContactGivenFamilyName = Template.bind({});
EmbeddedContactGivenFamilyName.args = {
  contact: {
    name: {
      givenName: 'Jerry',
      familyName: 'FamilyName',
    },
  },
};

export const EmbeddedContactFamilyName = Template.bind({});
EmbeddedContactFamilyName.args = {
  contact: {
    name: {
      familyName: 'FamilyName',
    },
  },
};

export const EmbeddedContactLoadingAvatar = Template.bind({});
EmbeddedContactLoadingAvatar.args = {
  contact: {
    name: {
      nickname: 'Jerry',
    },
    avatar: {
      avatar: fakeAttachment({
        pending: true,
        contentType: IMAGE_GIF,
      }),
      isProfile: true,
    },
  },
};

export const GiftBadgeUnopened = Template.bind({});
GiftBadgeUnopened.args = {
  giftBadge: {
    id: 'GIFT',
    expiration: Date.now() + DAY * 30,
    level: 3,
    state: GiftBadgeStates.Unopened,
  },
};

export const GiftBadgeFailed = Template.bind({});
GiftBadgeFailed.args = {
  giftBadge: {
    state: GiftBadgeStates.Failed,
  },
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

export const GiftBadgeRedeemed30Days = Template.bind({});
GiftBadgeRedeemed30Days.args = {
  getPreferredBadge,
  giftBadge: {
    expiration: Date.now() + DAY * 30 + SECOND,
    id: 'GIFT',
    level: 3,
    state: GiftBadgeStates.Redeemed,
  },
};

export const GiftBadgeRedeemed24Hours = Template.bind({});
GiftBadgeRedeemed24Hours.args = {
  getPreferredBadge,
  giftBadge: {
    expiration: Date.now() + DAY + SECOND,
    id: 'GIFT',
    level: 3,
    state: GiftBadgeStates.Redeemed,
  },
};

export const GiftBadgeOpened60Minutes = Template.bind({});
GiftBadgeOpened60Minutes.args = {
  getPreferredBadge,
  giftBadge: {
    expiration: Date.now() + HOUR + SECOND,
    id: 'GIFT',
    level: 3,
    state: GiftBadgeStates.Opened,
  },
};

export const GiftBadgeRedeemed1Minute = Template.bind({});
GiftBadgeRedeemed1Minute.args = {
  getPreferredBadge,
  giftBadge: {
    expiration: Date.now() + MINUTE + SECOND,
    id: 'GIFT',
    level: 3,
    state: GiftBadgeStates.Redeemed,
  },
};

export const GiftBadgeOpenedExpired = Template.bind({});
GiftBadgeOpenedExpired.args = {
  getPreferredBadge,
  giftBadge: {
    expiration: Date.now(),
    id: 'GIFT',
    level: 3,
    state: GiftBadgeStates.Opened,
  },
};

export const GiftBadgeMissingBadge = Template.bind({});
GiftBadgeMissingBadge.args = {
  getPreferredBadge: () => undefined,
  giftBadge: {
    expiration: Date.now() + MINUTE + SECOND,
    id: 'MISSING',
    level: 3,
    state: GiftBadgeStates.Redeemed,
  },
};

export const PaymentNotification = Template.bind({});
PaymentNotification.args = {
  canReply: false,
  canReact: false,
  payment: {
    kind: PaymentEventKind.Notification,
    note: 'Hello there',
  },
};

export const SMS = Template.bind({});
SMS.args = {
  isSMS: true,
  text: 'hello',
};

function MultiSelectMessage() {
  const [selected, setSelected] = React.useState(false);

  return (
    <TimelineMessage
      {...createProps({
        text: 'Hello',
        isSelected: selected,
        isSelectMode: true,
        toggleSelectMessage(_conversationId, _messageId, _shift, newSelected) {
          setSelected(newSelected);
        },
      })}
    />
  );
}

export function MultiSelect(): JSX.Element {
  return (
    <>
      <MultiSelectMessage />
      <MultiSelectMessage />
      <MultiSelectMessage />
    </>
  );
}

MultiSelect.args = {
  name: 'Multi Select',
};

export function PermanentlyUndownloadableAttachments(): JSX.Element {
  const imageProps = createProps({
    attachments: [
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'bird.jpg',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        width: 296,
        height: 394,
        path: undefined,
        key: undefined,
        id: undefined,
        error: true,
      }),
    ],
    status: 'sent',
  });
  const multipleImagesProps = createProps({
    attachments: [
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'bird.jpg',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        width: 296,
        height: 394,
        path: undefined,
        key: undefined,
        id: undefined,
        error: true,
      }),
      fakeAttachment({
        contentType: IMAGE_JPEG,
        fileName: 'bird.jpg',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        width: 296,
        height: 394,
        path: undefined,
        key: undefined,
        id: undefined,
        error: true,
      }),
    ],
    status: 'sent',
  });
  const gifProps = createProps({
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        flags: SignalService.AttachmentPointer.Flags.GIF,
        fileName: 'bird.gif',
        blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
        width: 296,
        height: 394,
        path: undefined,
        key: undefined,
        id: undefined,
        error: true,
      }),
    ],
    status: 'sent',
    text: 'cool gif',
  });
  const videoProps = createProps({
    attachments: [
      fakeAttachment({
        contentType: VIDEO_MP4,
        fileName: 'bird.mp4',
        width: 720,
        height: 480,
        path: undefined,
        key: undefined,
        id: undefined,
        error: true,
      }),
    ],
    status: 'sent',
  });
  const audioProps = createProps({
    attachments: [
      fakeAttachment({
        contentType: AUDIO_MP3,
        fileName: 'bird.mp3',
        width: undefined,
        height: undefined,
        path: undefined,
        key: undefined,
        id: undefined,
        error: true,
      }),
    ],
    status: 'sent',
  });
  const audioWithCaptionProps = {
    ...audioProps,
    text: "Here's that file",
  };
  const textFileProps = createProps({
    attachments: [
      fakeAttachment({
        contentType: stringToMIMEType('text/plain'),
        fileName: 'why-i-love-birds.txt',
        width: undefined,
        height: undefined,
        path: undefined,
        key: undefined,
        id: undefined,
        error: true,
      }),
    ],
    status: 'sent',
  });
  const textFileWithCaptionProps = {
    ...textFileProps,
    text: "Here's that file",
  };
  const stickerProps = createProps({
    attachments: [
      fakeAttachment({
        fileName: '512x515-thumbs-up-lincoln.webp',
        contentType: IMAGE_WEBP,
        width: 128,
        height: 128,
        error: true,
      }),
    ],
    isSticker: true,
    status: 'sent',
  });
  const longMessageProps = createProps({
    text: 'Hello there from a pal! I am sending a long message so that it will wrap a bit, since I like that look.',
    textAttachment: {
      contentType: LONG_MESSAGE,
      size: 123,
      pending: false,
      key: undefined,
      error: true,
    },
  });

  const outgoingAuthor = {
    ...imageProps.author,
    id: getDefaultConversation().id,
  };

  return (
    <>
      <TimelineMessage {...imageProps} shouldCollapseAbove />
      <TimelineMessage {...gifProps} />
      <TimelineMessage {...videoProps} />
      <TimelineMessage {...multipleImagesProps} />
      <TimelineMessage {...stickerProps} />
      <TimelineMessage {...textFileProps} />
      <TimelineMessage {...textFileWithCaptionProps} />
      <TimelineMessage {...longMessageProps} />
      <TimelineMessage {...audioProps} />
      <TimelineMessage {...audioWithCaptionProps} shouldCollapseBelow />
      <TimelineMessage
        {...imageProps}
        author={outgoingAuthor}
        direction="outgoing"
        shouldCollapseAbove
      />
      <TimelineMessage
        {...gifProps}
        author={outgoingAuthor}
        direction="outgoing"
      />
      <TimelineMessage
        {...videoProps}
        author={outgoingAuthor}
        direction="outgoing"
      />
      <TimelineMessage
        {...multipleImagesProps}
        author={outgoingAuthor}
        direction="outgoing"
      />
      <TimelineMessage
        {...textFileProps}
        author={outgoingAuthor}
        direction="outgoing"
      />
      <TimelineMessage
        {...stickerProps}
        author={outgoingAuthor}
        direction="outgoing"
      />
      <TimelineMessage
        {...textFileWithCaptionProps}
        author={outgoingAuthor}
        direction="outgoing"
      />
      <TimelineMessage
        {...longMessageProps}
        author={outgoingAuthor}
        direction="outgoing"
      />
      <TimelineMessage
        {...audioProps}
        author={outgoingAuthor}
        direction="outgoing"
      />
      <TimelineMessage
        {...audioWithCaptionProps}
        author={outgoingAuthor}
        direction="outgoing"
        shouldCollapseBelow
      />
    </>
  );
}

export const AttachmentWithError = Template.bind({});
AttachmentWithError.args = {
  attachments: [
    fakeAttachment({
      contentType: IMAGE_PNG,
      fileName: 'test.png',
      blurHash: 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
      width: 296,
      height: 394,
      path: undefined,
      error: true,
    }),
  ],
  status: 'sent',
};
