// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isString } from 'lodash';

import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { ConversationColors } from '../../types/Colors';
import { pngUrl } from '../../storybook/Fixtures';
import type { Props as MessagesProps } from './Message';
import { Message } from './Message';
import {
  AUDIO_MP3,
  IMAGE_PNG,
  LONG_MESSAGE,
  VIDEO_MP4,
  stringToMIMEType,
} from '../../types/MIME';
import type { Props } from './Quote';
import { Quote } from './Quote';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { WidthBreakpoint } from '../_util';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/Quote', module);

const defaultMessageProps: MessagesProps = {
  author: getDefaultConversation({
    id: 'some-id',
    title: 'Person X',
  }),
  canReply: true,
  canDeleteForEveryone: true,
  canDownload: true,
  checkForAccount: action('checkForAccount'),
  clearSelectedMessage: action('default--clearSelectedMessage'),
  containerElementRef: React.createRef<HTMLElement>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationColor: 'crimson',
  conversationId: 'conversationId',
  conversationType: 'direct', // override
  deleteMessage: action('default--deleteMessage'),
  deleteMessageForEveryone: action('default--deleteMessageForEveryone'),
  direction: 'incoming',
  displayTapToViewMessage: action('default--displayTapToViewMessage'),
  downloadAttachment: action('default--downloadAttachment'),
  doubleCheckMissingQuoteReference: action(
    'default--doubleCheckMissingQuoteReference'
  ),
  getPreferredBadge: () => undefined,
  i18n,
  id: 'messageId',
  renderingContext: 'storybook',
  interactionMode: 'keyboard',
  isBlocked: false,
  isMessageRequestAccepted: true,
  kickOffAttachmentDownload: action('default--kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('default--markAttachmentAsCorrupted'),
  markViewed: action('default--markViewed'),
  messageExpanded: action('dafult--message-expanded'),
  onHeightChange: action('default--onHeightChange'),
  openConversation: action('default--openConversation'),
  openLink: action('default--openLink'),
  previews: [],
  reactToMessage: action('default--reactToMessage'),
  readStatus: ReadStatus.Read,
  renderEmojiPicker: () => <div />,
  renderReactionPicker: () => <div />,
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
  replyToMessage: action('default--replyToMessage'),
  retrySend: action('default--retrySend'),
  scrollToQuotedMessage: action('default--scrollToQuotedMessage'),
  selectMessage: action('default--selectMessage'),
  showContactDetail: action('default--showContactDetail'),
  showContactModal: action('default--showContactModal'),
  showExpiredIncomingTapToViewToast: action(
    'showExpiredIncomingTapToViewToast'
  ),
  showExpiredOutgoingTapToViewToast: action(
    'showExpiredOutgoingTapToViewToast'
  ),
  showForwardMessageModal: action('default--showForwardMessageModal'),
  showMessageDetail: action('default--showMessageDetail'),
  showVisualAttachment: action('default--showVisualAttachment'),
  status: 'sent',
  text: 'This is really interesting.',
  theme: ThemeType.light,
  timestamp: Date.now(),
};

const renderInMessage = ({
  authorTitle,
  conversationColor,
  isFromMe,
  rawAttachment,
  isViewOnce,
  referencedMessageNotFound,
  text: quoteText,
}: Props) => {
  const messageProps = {
    ...defaultMessageProps,
    conversationColor,
    quote: {
      authorId: 'an-author',
      authorTitle,
      conversationColor,
      isFromMe,
      rawAttachment,
      isViewOnce,
      referencedMessageNotFound,
      sentAt: Date.now() - 30 * 1000,
      text: quoteText,
    },
  };

  return (
    <div style={{ overflow: 'hidden' }}>
      <Message {...messageProps} />
      <br />
      <Message {...messageProps} direction="outgoing" />
    </div>
  );
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  authorTitle: text('authorTitle', overrideProps.authorTitle || ''),
  conversationColor: overrideProps.conversationColor || 'forest',
  doubleCheckMissingQuoteReference:
    overrideProps.doubleCheckMissingQuoteReference ||
    action('doubleCheckMissingQuoteReference'),
  i18n,
  isFromMe: boolean('isFromMe', overrideProps.isFromMe || false),
  isIncoming: boolean('isIncoming', overrideProps.isIncoming || false),
  onClick: action('onClick'),
  onClose: action('onClose'),
  rawAttachment: overrideProps.rawAttachment || undefined,
  referencedMessageNotFound: boolean(
    'referencedMessageNotFound',
    overrideProps.referencedMessageNotFound || false
  ),
  isViewOnce: boolean('isViewOnce', overrideProps.isViewOnce || false),
  text: text(
    'text',
    isString(overrideProps.text)
      ? overrideProps.text
      : 'A sample message from a pal'
  ),
});

story.add('Outgoing by Another Author', () => {
  const props = createProps({
    authorTitle: 'Terrence Malick',
  });

  return <Quote {...props} />;
});

story.add('Outgoing by Me', () => {
  const props = createProps({
    isFromMe: true,
  });

  return <Quote {...props} />;
});

story.add('Incoming by Another Author', () => {
  const props = createProps({
    authorTitle: 'Terrence Malick',
    isIncoming: true,
  });

  return <Quote {...props} />;
});

story.add('Incoming by Me', () => {
  const props = createProps({
    isFromMe: true,
    isIncoming: true,
  });

  return <Quote {...props} />;
});

story.add('Incoming/Outgoing Colors', () => {
  const props = createProps({});
  return (
    <>
      {ConversationColors.map(color =>
        renderInMessage({ ...props, conversationColor: color })
      )}
    </>
  );
});

story.add('Image Only', () => {
  const props = createProps({
    text: '',
    rawAttachment: {
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      isVoiceMessage: false,
      thumbnail: {
        contentType: IMAGE_PNG,
        objectUrl: pngUrl,
      },
    },
  });

  return <Quote {...props} />;
});
story.add('Image Attachment', () => {
  const props = createProps({
    rawAttachment: {
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      isVoiceMessage: false,
      thumbnail: {
        contentType: IMAGE_PNG,
        objectUrl: pngUrl,
      },
    },
  });

  return <Quote {...props} />;
});

story.add('Image Attachment w/o Thumbnail', () => {
  const props = createProps({
    rawAttachment: {
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
});

story.add('Image Tap-to-View', () => {
  const props = createProps({
    text: '',
    isViewOnce: true,
    rawAttachment: {
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
});

story.add('Video Only', () => {
  const props = createProps({
    rawAttachment: {
      contentType: VIDEO_MP4,
      fileName: 'great-video.mp4',
      isVoiceMessage: false,
      thumbnail: {
        contentType: IMAGE_PNG,
        objectUrl: pngUrl,
      },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props.text = undefined as any;

  return <Quote {...props} />;
});

story.add('Video Attachment', () => {
  const props = createProps({
    rawAttachment: {
      contentType: VIDEO_MP4,
      fileName: 'great-video.mp4',
      isVoiceMessage: false,
      thumbnail: {
        contentType: IMAGE_PNG,
        objectUrl: pngUrl,
      },
    },
  });

  return <Quote {...props} />;
});

story.add('Video Attachment w/o Thumbnail', () => {
  const props = createProps({
    rawAttachment: {
      contentType: VIDEO_MP4,
      fileName: 'great-video.mp4',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
});

story.add('Video Tap-to-View', () => {
  const props = createProps({
    text: '',
    isViewOnce: true,
    rawAttachment: {
      contentType: VIDEO_MP4,
      fileName: 'great-video.mp4',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
});

story.add('Audio Only', () => {
  const props = createProps({
    rawAttachment: {
      contentType: AUDIO_MP3,
      fileName: 'great-video.mp3',
      isVoiceMessage: false,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props.text = undefined as any;

  return <Quote {...props} />;
});

story.add('Audio Attachment', () => {
  const props = createProps({
    rawAttachment: {
      contentType: AUDIO_MP3,
      fileName: 'great-video.mp3',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
});

story.add('Voice Message Only', () => {
  const props = createProps({
    rawAttachment: {
      contentType: AUDIO_MP3,
      fileName: 'great-video.mp3',
      isVoiceMessage: true,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props.text = undefined as any;

  return <Quote {...props} />;
});

story.add('Voice Message Attachment', () => {
  const props = createProps({
    rawAttachment: {
      contentType: AUDIO_MP3,
      fileName: 'great-video.mp3',
      isVoiceMessage: true,
    },
  });

  return <Quote {...props} />;
});

story.add('Other File Only', () => {
  const props = createProps({
    rawAttachment: {
      contentType: stringToMIMEType('application/json'),
      fileName: 'great-data.json',
      isVoiceMessage: false,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props.text = undefined as any;

  return <Quote {...props} />;
});

story.add('Media Tap-to-View', () => {
  const props = createProps({
    text: '',
    isViewOnce: true,
    rawAttachment: {
      contentType: AUDIO_MP3,
      fileName: 'great-video.mp3',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
});

story.add('Other File Attachment', () => {
  const props = createProps({
    rawAttachment: {
      contentType: stringToMIMEType('application/json'),
      fileName: 'great-data.json',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
});

story.add('Long message attachment (should be hidden)', () => {
  const props = createProps({
    rawAttachment: {
      contentType: LONG_MESSAGE,
      fileName: 'signal-long-message-123.txt',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
});

story.add('No Close Button', () => {
  const props = createProps();
  props.onClose = undefined;

  return <Quote {...props} />;
});

story.add('Message Not Found', () => {
  const props = createProps({
    referencedMessageNotFound: true,
  });

  return renderInMessage(props);
});

story.add('Missing Text & Attachment', () => {
  const props = createProps();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props.text = undefined as any;

  return <Quote {...props} />;
});

story.add('@mention + outgoing + another author', () => {
  const props = createProps({
    authorTitle: 'Tony Stark',
    text: '@Captain America Lunch later?',
  });

  return <Quote {...props} />;
});

story.add('@mention + outgoing + me', () => {
  const props = createProps({
    isFromMe: true,
    text: '@Captain America Lunch later?',
  });

  return <Quote {...props} />;
});

story.add('@mention + incoming + another author', () => {
  const props = createProps({
    authorTitle: 'Captain America',
    isIncoming: true,
    text: '@Tony Stark sure',
  });

  return <Quote {...props} />;
});

story.add('@mention + incoming + me', () => {
  const props = createProps({
    isFromMe: true,
    isIncoming: true,
    text: '@Tony Stark sure',
  });

  return <Quote {...props} />;
});

story.add('Custom Color', () => (
  <>
    <Quote
      {...createProps({ isIncoming: true, text: 'Solid + Gradient' })}
      customColor={{
        start: { hue: 82, saturation: 35 },
      }}
    />
    <Quote
      {...createProps()}
      customColor={{
        deg: 192,
        start: { hue: 304, saturation: 85 },
        end: { hue: 231, saturation: 76 },
      }}
    />
  </>
));
