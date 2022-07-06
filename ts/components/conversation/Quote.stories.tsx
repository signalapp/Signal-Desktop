// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import * as React from 'react';

import { action } from '@storybook/addon-actions';

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
  component: Quote,
  title: 'Components/Conversation/Quote',
  argTypes: {
    authorTitle: {
      defaultValue: 'Default Sender',
    },
    conversationColor: {
      defaultValue: 'forest',
    },
    doubleCheckMissingQuoteReference: { action: true },
    i18n: {
      defaultValue: i18n,
    },
    isFromMe: {
      control: { type: 'checkbox' },
      defaultValue: false,
    },
    isGiftBadge: {
      control: { type: 'checkbox' },
      defaultValue: false,
    },
    isIncoming: {
      control: { type: 'checkbox' },
      defaultValue: false,
    },
    isViewOnce: {
      control: { type: 'checkbox' },
      defaultValue: false,
    },
    onClick: { action: true },
    onClose: { action: true },
    rawAttachment: {
      defaultValue: undefined,
    },
    referencedMessageNotFound: {
      control: { type: 'checkbox' },
      defaultValue: false,
    },
    text: {
      defaultValue: 'A sample message from a pal',
    },
  },
} as Meta;

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

const Template: Story<Props> = args => <Quote {...args} />;
const TemplateInMessage: Story<Props> = args => renderInMessage(args);

export const OutgoingByAnotherAuthor = Template.bind({});
OutgoingByAnotherAuthor.args = {
  authorTitle: getDefaultConversation().title,
};
OutgoingByAnotherAuthor.story = {
  name: 'Outgoing by Another Author',
};

export const OutgoingByMe = Template.bind({});
OutgoingByMe.args = {
  isFromMe: true,
};
OutgoingByMe.story = {
  name: 'Outgoing by Me',
};

export const IncomingByAnotherAuthor = Template.bind({});
IncomingByAnotherAuthor.args = {
  authorTitle: getDefaultConversation().title,
  isIncoming: true,
};
IncomingByAnotherAuthor.story = {
  name: 'Incoming by Another Author',
};

export const IncomingByMe = Template.bind({});
IncomingByMe.args = {
  isFromMe: true,
  isIncoming: true,
};
IncomingByMe.story = {
  name: 'Incoming by Me',
};

export const IncomingOutgoingColors = (args: Props): JSX.Element => {
  return (
    <>
      {ConversationColors.map(color =>
        renderInMessage({ ...args, conversationColor: color })
      )}
    </>
  );
};
IncomingOutgoingColors.args = {};
IncomingOutgoingColors.story = {
  name: 'Incoming/Outgoing Colors',
};

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
ImageAttachmentNoThumbnail.story = {
  name: 'Image Attachment w/o Thumbnail',
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
ImageTapToView.story = {
  name: 'Image Tap-to-View',
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
VideoAttachmentNoThumbnail.story = {
  name: 'Video Attachment w/o Thumbnail',
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
VideoTapToView.story = {
  name: 'Video Tap-to-View',
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
MediaTapToView.story = {
  name: 'Media Tap-to-View',
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
LongMessageAttachmentShouldBeHidden.story = {
  name: 'Long message attachment (should be hidden)',
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
MissingTextAttachment.story = {
  name: 'Missing Text & Attachment',
};

export const MentionOutgoingAnotherAuthor = Template.bind({});
MentionOutgoingAnotherAuthor.args = {
  authorTitle: 'Tony Stark',
  text: '@Captain America Lunch later?',
};
MentionOutgoingAnotherAuthor.story = {
  name: '@mention + outgoing + another author',
};

export const MentionOutgoingMe = Template.bind({});
MentionOutgoingMe.args = {
  isFromMe: true,
  text: '@Captain America Lunch later?',
};
MentionOutgoingMe.story = {
  name: '@mention + outgoing + me',
};

export const MentionIncomingAnotherAuthor = Template.bind({});
MentionIncomingAnotherAuthor.args = {
  authorTitle: 'Captain America',
  isIncoming: true,
  text: '@Tony Stark sure',
};
MentionIncomingAnotherAuthor.story = {
  name: '@mention + incoming + another author',
};

export const MentionIncomingMe = Template.bind({});
MentionIncomingMe.args = {
  isFromMe: true,
  isIncoming: true,
  text: '@Tony Stark sure',
};
MentionIncomingMe.story = {
  name: '@mention + incoming + me',
};

export const CustomColor = (args: Props): JSX.Element => (
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
IsStoryReply.story = {
  name: 'isStoryReply',
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
      path: pngUrl,
      objectUrl: pngUrl,
    },
  },
  reactionEmoji: '🏋️',
};
IsStoryReplyEmoji.story = {
  name: 'isStoryReply emoji',
};
