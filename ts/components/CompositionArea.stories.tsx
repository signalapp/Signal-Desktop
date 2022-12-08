// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DecoratorFunction } from '@storybook/addons';
import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean, select } from '@storybook/addon-knobs';

import { IMAGE_JPEG } from '../types/MIME';
import type { Props } from './CompositionArea';
import { CompositionArea } from './CompositionArea';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';

import { fakeDraftAttachment } from '../test-both/helpers/fakeAttachment';
import { landscapeGreenUrl } from '../storybook/Fixtures';
import { RecordingState } from '../state/ducks/audioRecorder';
import { ConversationColors } from '../types/Colors';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { PaymentEventKind } from '../types/Payment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/CompositionArea',
  decorators: [
    // necessary for the add attachment button to render properly
    storyFn => <div className="file-input">{storyFn()}</div>,
  ] as Array<DecoratorFunction<JSX.Element>>,
};

const useProps = (overrideProps: Partial<Props> = {}): Props => ({
  addAttachment: action('addAttachment'),
  conversationId: '123',
  focusCounter: 0,
  i18n,
  isDisabled: false,
  messageCompositionId: '456',
  sendMultiMediaMessage: action('sendMultiMediaMessage'),
  processAttachments: action('processAttachments'),
  removeAttachment: action('removeAttachment'),
  theme: React.useContext(StorybookThemeContext),
  setComposerFocus: action('setComposerFocus'),

  // AttachmentList
  draftAttachments: overrideProps.draftAttachments || [],
  onClearAttachments: action('onClearAttachments'),
  // AudioCapture
  cancelRecording: action('cancelRecording'),
  completeRecording: action('completeRecording'),
  errorRecording: action('errorRecording'),
  recordingState: select(
    'recordingState',
    RecordingState,
    overrideProps.recordingState || RecordingState.Idle
  ),
  startRecording: action('startRecording'),
  // StagedLinkPreview
  linkPreviewLoading: Boolean(overrideProps.linkPreviewLoading),
  linkPreviewResult: overrideProps.linkPreviewResult,
  onCloseLinkPreview: action('onCloseLinkPreview'),
  // Quote
  quotedMessageProps: overrideProps.quotedMessageProps,
  onClickQuotedMessage: action('onClickQuotedMessage'),
  setQuotedMessage: action('setQuotedMessage'),
  // MediaEditor
  imageToBlurHash: async () => 'LDA,FDBnm+I=p{tkIUI;~UkpELV]',
  // MediaQualitySelector
  onSelectMediaQuality: action('onSelectMediaQuality'),
  shouldSendHighQualityAttachments: Boolean(
    overrideProps.shouldSendHighQualityAttachments
  ),
  // CompositionInput
  onEditorStateChange: action('onEditorStateChange'),
  onTextTooLong: action('onTextTooLong'),
  draftText: overrideProps.draftText || undefined,
  clearQuotedMessage: action('clearQuotedMessage'),
  getPreferredBadge: () => undefined,
  getQuotedMessage: action('getQuotedMessage'),
  sortedGroupMembers: [],
  // EmojiButton
  onPickEmoji: action('onPickEmoji'),
  onSetSkinTone: action('onSetSkinTone'),
  recentEmojis: [],
  skinTone: 1,
  // StickerButton
  knownPacks: overrideProps.knownPacks || [],
  receivedPacks: [],
  installedPacks: [],
  blessedPacks: [],
  recentStickers: [],
  clearInstalledStickerPack: action('clearInstalledStickerPack'),
  onClickAddPack: action('onClickAddPack'),
  sendStickerMessage: action('sendStickerMessage'),
  clearShowIntroduction: action('clearShowIntroduction'),
  showPickerHint: false,
  clearShowPickerHint: action('clearShowPickerHint'),
  // Message Requests
  conversationType: 'direct',
  acceptConversation: action('acceptConversation'),
  blockConversation: action('blockConversation'),
  blockAndReportSpam: action('blockAndReportSpam'),
  deleteConversation: action('deleteConversation'),
  messageRequestsEnabled: boolean(
    'messageRequestsEnabled',
    overrideProps.messageRequestsEnabled || false
  ),
  title: '',
  // GroupV1 Disabled Actions
  showGV2MigrationDialog: action('showGV2MigrationDialog'),
  // GroupV2
  announcementsOnly: boolean(
    'announcementsOnly',
    Boolean(overrideProps.announcementsOnly)
  ),
  areWeAdmin: boolean('areWeAdmin', Boolean(overrideProps.areWeAdmin)),
  groupAdmins: [],
  openConversation: action('openConversation'),
  onCancelJoinRequest: action('onCancelJoinRequest'),
  // SMS-only
  isSMSOnly: overrideProps.isSMSOnly || false,
  isFetchingUUID: overrideProps.isFetchingUUID || false,
});

export function Default(): JSX.Element {
  const props = useProps();

  return <CompositionArea {...props} />;
}

export function StartingText(): JSX.Element {
  const props = useProps({
    draftText: "here's some starting text",
  });

  return <CompositionArea {...props} />;
}

export function StickerButton(): JSX.Element {
  const props = useProps({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    knownPacks: [{} as any],
  });

  return <CompositionArea {...props} />;
}

export function MessageRequest(): JSX.Element {
  const props = useProps({
    messageRequestsEnabled: true,
  });

  return <CompositionArea {...props} />;
}

export function SmsOnlyFetchingUuid(): JSX.Element {
  const props = useProps({
    isSMSOnly: true,
    isFetchingUUID: true,
  });

  return <CompositionArea {...props} />;
}

SmsOnlyFetchingUuid.story = {
  name: 'SMS-only fetching UUID',
};

export function SmsOnly(): JSX.Element {
  const props = useProps({
    isSMSOnly: true,
  });

  return <CompositionArea {...props} />;
}

SmsOnly.story = {
  name: 'SMS-only',
};

export function Attachments(): JSX.Element {
  const props = useProps({
    draftAttachments: [
      fakeDraftAttachment({
        contentType: IMAGE_JPEG,
        url: landscapeGreenUrl,
      }),
    ],
  });

  return <CompositionArea {...props} />;
}

export function AnnouncementsOnlyGroup(): JSX.Element {
  return (
    <CompositionArea
      {...useProps({
        announcementsOnly: true,
        areWeAdmin: false,
      })}
    />
  );
}

AnnouncementsOnlyGroup.story = {
  name: 'Announcements Only group',
};

export function Quote(): JSX.Element {
  return (
    <CompositionArea
      {...useProps({
        quotedMessageProps: {
          text: 'something',
          conversationColor: ConversationColors[10],
          conversationTitle: getDefaultConversation().title,
          isGiftBadge: false,
          isViewOnce: false,
          referencedMessageNotFound: false,
          authorTitle: 'Someone',
          isFromMe: false,
        },
      })}
    />
  );
}

export function QuoteWithPayment(): JSX.Element {
  return (
    <CompositionArea
      {...useProps({
        quotedMessageProps: {
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
        },
      })}
    />
  );
}

QuoteWithPayment.story = {
  name: 'Quote with payment',
};
