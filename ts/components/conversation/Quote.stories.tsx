// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import * as React from 'react';

import { action } from '@storybook/addon-actions';

import { ConversationColors } from '../../types/Colors';
import { pngUrl } from '../../storybook/Fixtures';
import type { Props as TimelineMessagesProps } from './TimelineMessage';
import { TimelineMessage } from './TimelineMessage';
import { TextDirection } from './Message';
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
import { PaymentEventKind } from '../../types/Payment';

const i18n = setupI18n('en', enMessages);

export default {
  component: Quote,
  title: 'Components/Conversation/Quote',
  argTypes: {
    isFromMe: {
      control: { type: 'boolean' },
    },
    isGiftBadge: {
      control: { type: 'boolean' },
    },
    isIncoming: {
      control: { type: 'boolean' },
    },
    isViewOnce: {
      control: { type: 'boolean' },
    },
    referencedMessageNotFound: {
      control: { type: 'boolean' },
    },
  },
  args: {
    authorTitle: 'Default Sender',
    conversationColor: 'forest',
    doubleCheckMissingQuoteReference: action(
      'doubleCheckMissingQuoteReference'
    ),
    i18n,
    isFromMe: false,
    isGiftBadge: false,
    isIncoming: false,
    isViewOnce: false,
    onClick: action('onClick'),
    onClose: action('onClose'),
    rawAttachment: undefined,
    referencedMessageNotFound: false,
    text: 'A sample message from a pal',
  },
} satisfies Meta<Props>;

const defaultMessageProps: TimelineMessagesProps = {
  author: getDefaultConversation({
    id: 'some-id',
    title: 'Person X',
  }),
  canCopy: true,
  canEditMessage: true,
  canReact: true,
  canReply: true,
  canRetry: true,
  canRetryDeleteForEveryone: true,
  canDeleteForEveryone: true,
  canDownload: true,
  checkForAccount: action('checkForAccount'),
  clearTargetedMessage: action('default--clearTargetedMessage'),
  containerElementRef: React.createRef<HTMLElement>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationColor: 'crimson',
  conversationId: 'conversationId',
  conversationTitle: 'Conversation Title',
  conversationType: 'direct', // override
  direction: 'incoming',
  showLightboxForViewOnceMedia: action('default--showLightboxForViewOnceMedia'),
  doubleCheckMissingQuoteReference: action(
    'default--doubleCheckMissingQuoteReference'
  ),
  getPreferredBadge: () => undefined,
  i18n,
  platform: 'darwin',
  id: 'messageId',
  // renderingContext: 'storybook',
  interactionMode: 'keyboard',
  isBlocked: false,
  isMessageRequestAccepted: true,
  isSelected: false,
  isSelectMode: false,
  isSMS: false,
  isSpoilerExpanded: {},
  toggleSelectMessage: action('toggleSelectMessage'),
  cancelAttachmentDownload: action('default--cancelAttachmentDownload'),
  kickOffAttachmentDownload: action('default--kickOffAttachmentDownload'),
  markAttachmentAsCorrupted: action('default--markAttachmentAsCorrupted'),
  messageExpanded: action('default--message-expanded'),
  showConversation: action('default--showConversation'),
  openGiftBadge: action('openGiftBadge'),
  previews: [],
  reactToMessage: action('default--reactToMessage'),
  readStatus: ReadStatus.Read,
  renderEmojiPicker: () => <div />,
  renderReactionPicker: () => <div />,
  renderAudioAttachment: () => <div>*AudioAttachment*</div>,
  setMessageToEdit: action('setMessageToEdit'),
  setQuoteByMessageId: action('default--setQuoteByMessageId'),
  retryMessageSend: action('default--retryMessageSend'),
  copyMessageText: action('copyMessageText'),
  retryDeleteForEveryone: action('default--retryDeleteForEveryone'),
  saveAttachment: action('saveAttachment'),
  saveAttachments: action('saveAttachments'),
  scrollToQuotedMessage: action('default--scrollToQuotedMessage'),
  targetMessage: action('default--targetMessage'),
  shouldCollapseAbove: false,
  shouldCollapseBelow: false,
  shouldHideMetadata: false,
  showSpoiler: action('showSpoiler'),
  pushPanelForConversation: action('default--pushPanelForConversation'),
  showContactModal: action('default--showContactModal'),
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
  toggleDeleteMessagesModal: action('default--toggleDeleteMessagesModal'),
  toggleForwardMessagesModal: action('default--toggleForwardMessagesModal'),
  showLightbox: action('default--showLightbox'),
  startConversation: action('default--startConversation'),
  status: 'sent',
  text: 'This is really interesting.',
  textDirection: TextDirection.Default,
  theme: ThemeType.light,
  timestamp: Date.now(),
  viewStory: action('viewStory'),
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
      conversationTitle: getDefaultConversation().title,
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
      <TimelineMessage {...messageProps} />
      <br />
      <TimelineMessage {...messageProps} direction="outgoing" />
    </div>
  );
};

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<Props> = args => <Quote {...args} />;
const TemplateInMessage: StoryFn<Props> = args => renderInMessage(args);

export const OutgoingByAnotherAuthor = Template.bind({});
OutgoingByAnotherAuthor.args = {
  authorTitle: getDefaultConversation().title,
};

export const OutgoingByMe = Template.bind({});
OutgoingByMe.args = {
  isFromMe: true,
};

export const IncomingByAnotherAuthor = Template.bind({});
IncomingByAnotherAuthor.args = {
  authorTitle: getDefaultConversation().title,
  isIncoming: true,
};

export const IncomingByMe = Template.bind({});
IncomingByMe.args = {
  isFromMe: true,
  isIncoming: true,
};

export function IncomingOutgoingColors(args: Props): JSX.Element {
  return (
    <>
      {ConversationColors.map(color =>
        renderInMessage({ ...args, conversationColor: color })
      )}
    </>
  );
}
IncomingOutgoingColors.args = {};

export const ImageOnly = Template.bind({});
ImageOnly.args = {
  text: '',
  rawAttachment: {
    contentType: IMAGE_PNG,
    fileName: 'sax.png',
    isVoiceMessage: false,
    thumbnail: {
      contentType: IMAGE_PNG,
      height: 100,
      width: 100,
      size: 100,
      path: pngUrl,
      objectUrl: pngUrl,
    },
  },
};

export const ImageAttachment = Template.bind({});
ImageAttachment.args = {
  rawAttachment: {
    contentType: IMAGE_PNG,
    fileName: 'sax.png',
    isVoiceMessage: false,
    thumbnail: {
      contentType: IMAGE_PNG,
      height: 100,
      width: 100,
      size: 100,
      path: pngUrl,
      objectUrl: pngUrl,
    },
  },
};

export const ImageAttachmentNoThumbnail = Template.bind({});
ImageAttachmentNoThumbnail.args = {
  rawAttachment: {
    contentType: IMAGE_PNG,
    fileName: 'sax.png',
    isVoiceMessage: false,
  },
};

export const ImageTapToView = Template.bind({});
ImageTapToView.args = {
  text: '',
  isViewOnce: true,
  rawAttachment: {
    contentType: IMAGE_PNG,
    fileName: 'sax.png',
    isVoiceMessage: false,
  },
};

export const VideoOnly = Template.bind({});
VideoOnly.args = {
  rawAttachment: {
    contentType: VIDEO_MP4,
    fileName: 'great-video.mp4',
    isVoiceMessage: false,
    thumbnail: {
      contentType: IMAGE_PNG,
      height: 100,
      width: 100,
      size: 100,
      path: pngUrl,
      objectUrl: pngUrl,
    },
  },
  text: undefined,
};

export const VideoAttachment = Template.bind({});
VideoAttachment.args = {
  rawAttachment: {
    contentType: VIDEO_MP4,
    fileName: 'great-video.mp4',
    isVoiceMessage: false,
    thumbnail: {
      contentType: IMAGE_PNG,
      height: 100,
      width: 100,
      size: 100,
      path: pngUrl,
      objectUrl: pngUrl,
    },
  },
};

export const VideoAttachmentNoThumbnail = Template.bind({});
VideoAttachmentNoThumbnail.args = {
  rawAttachment: {
    contentType: VIDEO_MP4,
    fileName: 'great-video.mp4',
    isVoiceMessage: false,
  },
};

export const VideoTapToView = Template.bind({});
VideoTapToView.args = {
  text: '',
  isViewOnce: true,
  rawAttachment: {
    contentType: VIDEO_MP4,
    fileName: 'great-video.mp4',
    isVoiceMessage: false,
  },
};

export const GiftBadge = TemplateInMessage.bind({});
GiftBadge.args = {
  text: "Some text which shouldn't be rendered",
  isGiftBadge: true,
};

export const AudioOnly = Template.bind({});
AudioOnly.args = {
  rawAttachment: {
    contentType: AUDIO_MP3,
    fileName: 'great-video.mp3',
    isVoiceMessage: false,
  },
  text: undefined,
};

export const AudioAttachment = Template.bind({});
AudioAttachment.args = {
  rawAttachment: {
    contentType: AUDIO_MP3,
    fileName: 'great-video.mp3',
    isVoiceMessage: false,
  },
};

export const VoiceMessageOnly = Template.bind({});
VoiceMessageOnly.args = {
  rawAttachment: {
    contentType: AUDIO_MP3,
    fileName: 'great-video.mp3',
    isVoiceMessage: true,
  },
  text: undefined,
};

export const VoiceMessageAttachment = Template.bind({});
VoiceMessageAttachment.args = {
  rawAttachment: {
    contentType: AUDIO_MP3,
    fileName: 'great-video.mp3',
    isVoiceMessage: true,
  },
};

export const OtherFileOnly = Template.bind({});
OtherFileOnly.args = {
  rawAttachment: {
    contentType: stringToMIMEType('application/json'),
    fileName: 'great-data.json',
    isVoiceMessage: false,
  },
  text: undefined,
};

export const MediaTapToView = Template.bind({});
MediaTapToView.args = {
  text: '',
  isViewOnce: true,
  rawAttachment: {
    contentType: AUDIO_MP3,
    fileName: 'great-video.mp3',
    isVoiceMessage: false,
  },
};

export const OtherFileAttachment = Template.bind({});
OtherFileAttachment.args = {
  rawAttachment: {
    contentType: stringToMIMEType('application/json'),
    fileName: 'great-data.json',
    isVoiceMessage: false,
  },
};

export const LongMessageAttachmentShouldBeHidden = Template.bind({});
LongMessageAttachmentShouldBeHidden.args = {
  rawAttachment: {
    contentType: LONG_MESSAGE,
    fileName: 'signal-long-message-123.txt',
    isVoiceMessage: false,
  },
};

export const NoCloseButton = Template.bind({});
NoCloseButton.args = {
  onClose: undefined,
};

export const MessageNotFound = TemplateInMessage.bind({});
MessageNotFound.args = {
  referencedMessageNotFound: true,
};

export const MissingTextAttachment = Template.bind({});
MissingTextAttachment.args = {
  text: undefined,
};

export const MentionOutgoingAnotherAuthor = Template.bind({});
MentionOutgoingAnotherAuthor.args = {
  authorTitle: 'Tony Stark',
  text: '@Captain America Lunch later?',
};

export const MentionOutgoingMe = Template.bind({});
MentionOutgoingMe.args = {
  isFromMe: true,
  text: '@Captain America Lunch later?',
};

export const MentionIncomingAnotherAuthor = Template.bind({});
MentionIncomingAnotherAuthor.args = {
  authorTitle: 'Captain America',
  isIncoming: true,
  text: '@Tony Stark sure',
};

export const MentionIncomingMe = Template.bind({});
MentionIncomingMe.args = {
  isFromMe: true,
  isIncoming: true,
  text: '@Tony Stark sure',
};

export function CustomColor(args: Props): JSX.Element {
  return (
    <>
      <Quote
        {...args}
        customColor={{
          start: { hue: 82, saturation: 35 },
        }}
      />
      <Quote
        {...args}
        isIncoming={false}
        text="A gradient"
        customColor={{
          deg: 192,
          start: { hue: 304, saturation: 85 },
          end: { hue: 231, saturation: 76 },
        }}
      />
    </>
  );
}
CustomColor.args = {
  isIncoming: true,
  text: 'Solid + Gradient',
};

export const IsStoryReply = Template.bind({});
IsStoryReply.args = {
  text: 'Wow!',
  authorTitle: 'Amanda',
  isStoryReply: true,
  moduleClassName: 'StoryReplyQuote',
  onClose: undefined,
  rawAttachment: {
    contentType: VIDEO_MP4,
    fileName: 'great-video.mp4',
    isVoiceMessage: false,
  },
};

export const IsStoryReplyEmoji = Template.bind({});
IsStoryReplyEmoji.args = {
  authorTitle: getDefaultConversation().firstName,
  isStoryReply: true,
  moduleClassName: 'StoryReplyQuote',
  onClose: undefined,
  rawAttachment: {
    contentType: IMAGE_PNG,
    fileName: 'sax.png',
    isVoiceMessage: false,
    thumbnail: {
      contentType: IMAGE_PNG,
      height: 100,
      width: 100,
      size: 100,
      path: pngUrl,
      objectUrl: pngUrl,
    },
  },
  reactionEmoji: '🏋️',
};

export const Payment = Template.bind({});
Payment.args = {
  text: '',
  payment: {
    kind: PaymentEventKind.Notification,
    note: null,
  },
};
