// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isString } from 'lodash';

import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';

import { ConversationColors } from '../../types/Colors';
import { pngUrl } from '../../storybook/Fixtures';
import type { Props as MessagesProps } from './Message';
import { Message, TextDirection } from './Message';
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

export default {
  title: 'Components/Conversation/Quote',
};

const defaultMessageProps: MessagesProps = {
  author: getDefaultConversation({
    id: 'some-id',
    title: 'Person X',
  }),
  canReact: true,
  canReply: true,
  canRetry: true,
  canRetryDeleteForEveryone: true,
  canDeleteForEveryone: true,
  canDownload: true,
  checkForAccount: action('checkForAccount'),
  clearSelectedMessage: action('default--clearSelectedMessage'),
  containerElementRef: React.createRef<HTMLElement>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationColor: 'crimson',
  conversationId: 'conversationId',
  conversationTitle: 'Conversation Title',
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
  messageExpanded: action('default--message-expanded'),
  openConversation: action('default--openConversation'),
  openGiftBadge: action('openGiftBadge'),
  openLink: action('default--openLink'),
  previews: [],
  reactToMessage: action('default--reactToMessage'),
  readStatus: ReadStatus.Read,
  renderEmojiPicker: () => <div />,
  renderReactionPicker: () => <div />,
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
  replyToMessage: action('default--replyToMessage'),
  retrySend: action('default--retrySend'),
  retryDeleteForEveryone: action('default--retryDeleteForEveryone'),
  scrollToQuotedMessage: action('default--scrollToQuotedMessage'),
  selectMessage: action('default--selectMessage'),
  shouldCollapseAbove: false,
  shouldCollapseBelow: false,
  shouldHideMetadata: false,
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
  startConversation: action('default--startConversation'),
  status: 'sent',
  text: 'This is really interesting.',
  textDirection: TextDirection.Default,
  theme: ThemeType.light,
  timestamp: Date.now(),
};

const renderInMessage = ({
  authorTitle,
  conversationColor,
  isFromMe,
  rawAttachment,
  isViewOnce,
  isGiftBadge,
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
      isGiftBadge,
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
  authorTitle: text(
    'authorTitle',
    overrideProps.authorTitle || 'Default Sender'
  ),
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
  isGiftBadge: boolean('isGiftBadge', overrideProps.isGiftBadge || false),
  isViewOnce: boolean('isViewOnce', overrideProps.isViewOnce || false),
  text: text(
    'text',
    isString(overrideProps.text)
      ? overrideProps.text
      : 'A sample message from a pal'
  ),
});

export const OutgoingByAnotherAuthor = (): JSX.Element => {
  const props = createProps({
    authorTitle: 'Terrence Malick',
  });

  return <Quote {...props} />;
};

OutgoingByAnotherAuthor.story = {
  name: 'Outgoing by Another Author',
};

export const OutgoingByMe = (): JSX.Element => {
  const props = createProps({
    isFromMe: true,
  });

  return <Quote {...props} />;
};

OutgoingByMe.story = {
  name: 'Outgoing by Me',
};

export const IncomingByAnotherAuthor = (): JSX.Element => {
  const props = createProps({
    authorTitle: 'Terrence Malick',
    isIncoming: true,
  });

  return <Quote {...props} />;
};

IncomingByAnotherAuthor.story = {
  name: 'Incoming by Another Author',
};

export const IncomingByMe = (): JSX.Element => {
  const props = createProps({
    isFromMe: true,
    isIncoming: true,
  });

  return <Quote {...props} />;
};

IncomingByMe.story = {
  name: 'Incoming by Me',
};

export const IncomingOutgoingColors = (): JSX.Element => {
  const props = createProps({});
  return (
    <>
      {ConversationColors.map(color =>
        renderInMessage({ ...props, conversationColor: color })
      )}
    </>
  );
};

IncomingOutgoingColors.story = {
  name: 'Incoming/Outgoing Colors',
};

export const ImageOnly = (): JSX.Element => {
  const props = createProps({
    text: '',
    rawAttachment: {
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      isVoiceMessage: false,
      thumbnail: {
        contentType: IMAGE_PNG,
        height: 100,
        width: 100,
        path: pngUrl,
        objectUrl: pngUrl,
      },
    },
  });

  return <Quote {...props} />;
};

export const ImageAttachment = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      isVoiceMessage: false,
      thumbnail: {
        contentType: IMAGE_PNG,
        height: 100,
        width: 100,
        path: pngUrl,
        objectUrl: pngUrl,
      },
    },
  });

  return <Quote {...props} />;
};

export const ImageAttachmentWOThumbnail = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
};

ImageAttachmentWOThumbnail.story = {
  name: 'Image Attachment w/o Thumbnail',
};

export const ImageTapToView = (): JSX.Element => {
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
};

ImageTapToView.story = {
  name: 'Image Tap-to-View',
};

export const VideoOnly = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: VIDEO_MP4,
      fileName: 'great-video.mp4',
      isVoiceMessage: false,
      thumbnail: {
        contentType: IMAGE_PNG,
        height: 100,
        width: 100,
        path: pngUrl,
        objectUrl: pngUrl,
      },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props.text = undefined as any;

  return <Quote {...props} />;
};

export const VideoAttachment = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: VIDEO_MP4,
      fileName: 'great-video.mp4',
      isVoiceMessage: false,
      thumbnail: {
        contentType: IMAGE_PNG,
        height: 100,
        width: 100,
        path: pngUrl,
        objectUrl: pngUrl,
      },
    },
  });

  return <Quote {...props} />;
};

export const VideoAttachmentWOThumbnail = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: VIDEO_MP4,
      fileName: 'great-video.mp4',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
};

VideoAttachmentWOThumbnail.story = {
  name: 'Video Attachment w/o Thumbnail',
};

export const VideoTapToView = (): JSX.Element => {
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
};

VideoTapToView.story = {
  name: 'Video Tap-to-View',
};

export const GiftBadge = (): JSX.Element => {
  const props = createProps({
    text: "Some text which shouldn't be rendered",
    isGiftBadge: true,
  });

  return renderInMessage(props);
};

export const AudioOnly = (): JSX.Element => {
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
};

export const AudioAttachment = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: AUDIO_MP3,
      fileName: 'great-video.mp3',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
};

export const VoiceMessageOnly = (): JSX.Element => {
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
};

export const VoiceMessageAttachment = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: AUDIO_MP3,
      fileName: 'great-video.mp3',
      isVoiceMessage: true,
    },
  });

  return <Quote {...props} />;
};

export const OtherFileOnly = (): JSX.Element => {
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
};

export const MediaTapToView = (): JSX.Element => {
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
};

MediaTapToView.story = {
  name: 'Media Tap-to-View',
};

export const OtherFileAttachment = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: stringToMIMEType('application/json'),
      fileName: 'great-data.json',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
};

export const LongMessageAttachmentShouldBeHidden = (): JSX.Element => {
  const props = createProps({
    rawAttachment: {
      contentType: LONG_MESSAGE,
      fileName: 'signal-long-message-123.txt',
      isVoiceMessage: false,
    },
  });

  return <Quote {...props} />;
};

LongMessageAttachmentShouldBeHidden.story = {
  name: 'Long message attachment (should be hidden)',
};

export const NoCloseButton = (): JSX.Element => {
  const props = createProps();
  props.onClose = undefined;

  return <Quote {...props} />;
};

export const MessageNotFound = (): JSX.Element => {
  const props = createProps({
    referencedMessageNotFound: true,
  });

  return renderInMessage(props);
};

export const MissingTextAttachment = (): JSX.Element => {
  const props = createProps();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props.text = undefined as any;

  return <Quote {...props} />;
};

MissingTextAttachment.story = {
  name: 'Missing Text & Attachment',
};

export const MentionOutgoingAnotherAuthor = (): JSX.Element => {
  const props = createProps({
    authorTitle: 'Tony Stark',
    text: '@Captain America Lunch later?',
  });

  return <Quote {...props} />;
};

MentionOutgoingAnotherAuthor.story = {
  name: '@mention + outgoing + another author',
};

export const MentionOutgoingMe = (): JSX.Element => {
  const props = createProps({
    isFromMe: true,
    text: '@Captain America Lunch later?',
  });

  return <Quote {...props} />;
};

MentionOutgoingMe.story = {
  name: '@mention + outgoing + me',
};

export const MentionIncomingAnotherAuthor = (): JSX.Element => {
  const props = createProps({
    authorTitle: 'Captain America',
    isIncoming: true,
    text: '@Tony Stark sure',
  });

  return <Quote {...props} />;
};

MentionIncomingAnotherAuthor.story = {
  name: '@mention + incoming + another author',
};

export const MentionIncomingMe = (): JSX.Element => {
  const props = createProps({
    isFromMe: true,
    isIncoming: true,
    text: '@Tony Stark sure',
  });

  return <Quote {...props} />;
};

MentionIncomingMe.story = {
  name: '@mention + incoming + me',
};

export const CustomColor = (): JSX.Element => (
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
);

export const IsStoryReply = (): JSX.Element => {
  const props = createProps({
    text: 'Wow!',
  });

  return (
    <Quote
      {...props}
      authorTitle="Amanda"
      isStoryReply
      moduleClassName="StoryReplyQuote"
      onClose={undefined}
      rawAttachment={{
        contentType: VIDEO_MP4,
        fileName: 'great-video.mp4',
        isVoiceMessage: false,
      }}
    />
  );
};

IsStoryReply.story = {
  name: 'isStoryReply',
};

export const IsStoryReplyEmoji = (): JSX.Element => {
  const props = createProps();

  return (
    <Quote
      {...props}
      authorTitle="Charlie"
      isStoryReply
      moduleClassName="StoryReplyQuote"
      onClose={undefined}
      rawAttachment={{
        contentType: IMAGE_PNG,
        fileName: 'sax.png',
        isVoiceMessage: false,
        thumbnail: {
          contentType: IMAGE_PNG,
          height: 100,
          width: 100,
          path: pngUrl,
          objectUrl: pngUrl,
        },
      }}
      reactionEmoji="🏋️"
    />
  );
};

IsStoryReplyEmoji.story = {
  name: 'isStoryReply emoji',
};
