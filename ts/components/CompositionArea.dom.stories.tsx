// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useContext, useState } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { IMAGE_JPEG } from '../types/MIME.std.js';
import type { Props } from './CompositionArea.dom.js';
import { CompositionArea } from './CompositionArea.dom.js';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext.std.js';

import { fakeDraftAttachment } from '../test-helpers/fakeAttachment.std.js';
import { landscapeGreenUrl } from '../storybook/Fixtures.std.js';
import { RecordingState } from '../types/AudioRecorder.std.js';
import { ConversationColors } from '../types/Colors.std.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import { PaymentEventKind } from '../types/Payment.std.js';
import { EmojiSkinTone } from './fun/data/emojis.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CompositionArea',
  decorators: [
    // necessary for the add attachment button to render properly
    storyFn => <div className="file-input">{storyFn()}</div>,
  ],
  argTypes: {
    recordingState: {
      control: { type: 'select' },
      options: Object.keys(RecordingState),
      mappings: RecordingState,
    },
    announcementsOnly: { control: { type: 'boolean' } },
    areWePendingApproval: { control: { type: 'boolean' } },
  },
  args: {
    acceptedMessageRequest: true,
    addAttachment: action('addAttachment'),
    conversationId: '123',
    convertDraftBodyRangesIntoHydrated: () => undefined,
    discardEditMessage: action('discardEditMessage'),
    focusCounter: 0,
    sendCounter: 0,
    i18n,
    isDisabled: false,
    isFormattingEnabled: true,
    messageCompositionId: '456',
    sendEditedMessage: action('sendEditedMessage'),
    sendMultiMediaMessage: action('sendMultiMediaMessage'),
    platform: 'darwin',
    processAttachments: action('processAttachments'),
    removeAttachment: action('removeAttachment'),
    setComposerFocus: action('setComposerFocus'),
    setMessageToEdit: action('setMessageToEdit'),
    setQuoteByMessageId: action('setQuoteByMessageId'),
    showToast: action('showToast'),

    // AttachmentList
    draftAttachments: [],
    onClearAttachments: action('onClearAttachments'),
    // AudioCapture
    cancelRecording: action('cancelRecording'),
    completeRecording: action('completeRecording'),
    errorRecording: action('errorRecording'),
    recordingState: RecordingState.Idle,
    startRecording: action('startRecording'),
    // StagedLinkPreview
    linkPreviewLoading: false,
    linkPreviewResult: undefined,
    onCloseLinkPreview: action('onCloseLinkPreview'),
    // Quote
    quotedMessageProps: undefined,
    scrollToMessage: action('scrollToMessage'),
    // MediaEditor
    imageToBlurHash: async () => 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
    // MediaQualitySelector
    setMediaQualitySetting: action('setMediaQualitySetting'),
    shouldSendHighQualityAttachments: false,
    // CompositionInput
    onEditorStateChange: action('onEditorStateChange'),
    onTextTooLong: action('onTextTooLong'),
    draftText: undefined,
    getPreferredBadge: () => undefined,
    sortedGroupMembers: [],
    // FunPicker
    onSelectEmoji: action('onSelectEmoji'),
    emojiSkinToneDefault: EmojiSkinTone.Type1,
    pushPanelForConversation: action('pushPanelForConversation'),
    sendStickerMessage: action('sendStickerMessage'),
    // Message Requests
    conversationType: 'direct',
    acceptConversation: action('acceptConversation'),
    blockConversation: action('blockConversation'),
    blockAndReportSpam: action('blockAndReportSpam'),
    deleteConversation: action('deleteConversation'),
    conversationName: getDefaultConversation(),
    // GroupV1 Disabled Actions
    showGV2MigrationDialog: action('showGV2MigrationDialog'),
    // GroupV2
    announcementsOnly: false,
    areWeAdmin: false,
    areWePendingApproval: false,
    groupAdmins: [],
    cancelJoinRequest: action('cancelJoinRequest'),
    showConversation: action('showConversation'),
    isSmsOnlyOrUnregistered: false,
    isFetchingUUID: false,
    renderSmartCompositionRecording: () => <div>RECORDING</div>,
    renderSmartCompositionRecordingDraft: _ => <div>RECORDING DRAFT</div>,
    // Select mode
    selectedMessageIds: undefined,
    toggleSelectMode: action('toggleSelectMode'),
    toggleForwardMessagesModal: action('toggleForwardMessagesModal'),
    // Signal Conversation
    isSignalConversation: false,
    isMuted: false,
    setMuteExpiration: action('setMuteExpiration'),
  },
} satisfies Meta<Props>;

export function Default(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return <CompositionArea {...args} theme={theme} />;
}

export function StartingText(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <CompositionArea
      {...args}
      theme={theme}
      draftText="here's some starting text"
    />
  );
}

export function StickerButton(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return <CompositionArea {...args} theme={theme} />;
}

export function MessageRequest(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <CompositionArea {...args} theme={theme} acceptedMessageRequest={false} />
  );
}

export function SmsOnlyFetchingUuid(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <CompositionArea
      {...args}
      theme={theme}
      isSmsOnlyOrUnregistered
      isFetchingUUID
    />
  );
}

export function SmsOnly(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return <CompositionArea {...args} theme={theme} isSmsOnlyOrUnregistered />;
}

export function Attachments(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <CompositionArea
      {...args}
      theme={theme}
      draftAttachments={[
        fakeDraftAttachment({
          contentType: IMAGE_JPEG,
          url: landscapeGreenUrl,
        }),
      ]}
    />
  );
}

export function PendingApproval(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return <CompositionArea {...args} theme={theme} areWePendingApproval />;
}

export function AnnouncementsOnlyGroup(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <CompositionArea
      {...args}
      theme={theme}
      announcementsOnly
      areWeAdmin={false}
    />
  );
}

export function Quote(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <CompositionArea
      {...args}
      theme={theme}
      quotedMessageProps={{
        text: 'something',
        conversationColor: ConversationColors[10],
        conversationTitle: getDefaultConversation().title,
        isGiftBadge: false,
        isViewOnce: false,
        referencedMessageNotFound: false,
        authorTitle: 'Someone',
        isFromMe: false,
      }}
    />
  );
}

export function QuoteWithPayment(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <CompositionArea
      {...args}
      theme={theme}
      quotedMessageProps={{
        text: '',
        conversationColor: ConversationColors[10],
        conversationTitle: getDefaultConversation().title,
        isGiftBadge: false,
        isViewOnce: false,
        referencedMessageNotFound: false,
        authorTitle: 'Someone',
        isFromMe: false,
        payment: {
          kind: PaymentEventKind.Notification,
          note: 'Thanks',
        },
      }}
    />
  );
}

export function NoFormattingMenu(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <CompositionArea {...args} theme={theme} isFormattingEnabled={false} />
  );
}

export function SignalConversationMuteToggle(args: Props): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  const [isMuted, setIsMuted] = useState(true);

  function setIsMutedByTime(_: string, muteExpiresAt: number) {
    setIsMuted(muteExpiresAt > Date.now());
  }
  return (
    <CompositionArea
      {...args}
      theme={theme}
      isSignalConversation
      isMuted={isMuted}
      setMuteExpiration={setIsMutedByTime}
    />
  );
}
