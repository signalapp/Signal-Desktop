// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import enMessages from '../../_locales/en/messages.json';
import type { AttachmentType } from '../types/Attachment';
import type { PropsType } from './ForwardMessagesModal';
import {
  ForwardMessagesModal,
  ForwardMessagesModalType,
} from './ForwardMessagesModal';
import { IMAGE_JPEG, VIDEO_MP4, stringToMIMEType } from '../types/MIME';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import { CompositionTextArea } from './CompositionTextArea';
import type { MessageForwardDraft } from '../types/ForwardDraft';

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  pending: false,
  path: 'fileName.jpg',
  contentType: stringToMIMEType(props.contentType ?? ''),
  fileName: props.fileName ?? '',
  screenshotPath: props.pending === false ? props.screenshotPath : undefined,
  url: props.pending === false ? (props.url ?? '') : '',
  size: 3433,
});

export default {
  title: 'Components/ForwardMessageModal',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

const i18n = setupI18n('en', enMessages);

const LONG_TITLE =
  "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?";
const LONG_DESCRIPTION =
  "You're gonna love this description. Not only does it have a lot of characters, but it will also be truncated in the UI. How cool is that??";
const candidateConversations = Array.from(Array(100), () =>
  getDefaultConversation()
);

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  drafts: overrideProps.drafts ?? [],
  candidateConversations,
  doForwardMessages: action('doForwardMessages'),
  getPreferredBadge: () => undefined,
  i18n,
  isInFullScreenCall: false,
  linkPreviewForSource: () => undefined,
  onClose: action('onClose'),
  onChange: action('onChange'),
  removeLinkPreview: action('removeLinkPreview'),
  RenderCompositionTextArea: props => (
    <CompositionTextArea
      {...props}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      isActive
      isFormattingEnabled
      onPickEmoji={action('onPickEmoji')}
      onSetSkinTone={action('onSetSkinTone')}
      onTextTooLong={action('onTextTooLong')}
      ourConversationId="me"
      platform="darwin"
      skinTone={0}
    />
  ),
  showToast: action('showToast'),
  type: ForwardMessagesModalType.Forward,
  theme: React.useContext(StorybookThemeContext),
  regionCode: 'US',
});

function getMessageForwardDraft(
  overrideProps: Partial<MessageForwardDraft>
): MessageForwardDraft {
  return {
    attachments: overrideProps.attachments,
    hasContact: Boolean(overrideProps.hasContact),
    isSticker: Boolean(overrideProps.isSticker),
    messageBody: overrideProps.messageBody ?? '',
    originalMessageId: '123',
    previews: overrideProps.previews ?? [],
  };
}

export function Modal(): JSX.Element {
  return <ForwardMessagesModal {...useProps()} />;
}

export function WithText(): JSX.Element {
  return (
    <ForwardMessagesModal
      {...useProps({
        drafts: [getMessageForwardDraft({ messageBody: 'sup' })],
      })}
    />
  );
}

export function ASticker(): JSX.Element {
  return (
    <ForwardMessagesModal
      {...useProps({
        drafts: [getMessageForwardDraft({ isSticker: true })],
      })}
    />
  );
}

export function WithAContact(): JSX.Element {
  return (
    <ForwardMessagesModal
      {...useProps({
        drafts: [getMessageForwardDraft({ hasContact: true })],
      })}
    />
  );
}

export function LinkPreview(): JSX.Element {
  return (
    <ForwardMessagesModal
      {...useProps({
        drafts: [
          getMessageForwardDraft({
            messageBody: 'signal.org',
            previews: [
              {
                description: LONG_DESCRIPTION,
                date: Date.now(),
                domain: 'https://www.signal.org',
                url: 'signal.org',
                image: createAttachment({
                  url: '/fixtures/kitten-4-112-112.jpg',
                  contentType: IMAGE_JPEG,
                }),
                isStickerPack: false,
                isCallLink: false,
                title: LONG_TITLE,
              },
            ],
          }),
        ],
      })}
    />
  );
}

export function MediaAttachments(): JSX.Element {
  return (
    <ForwardMessagesModal
      {...useProps({
        drafts: [
          getMessageForwardDraft({
            messageBody: 'cats',
            attachments: [
              createAttachment({
                pending: true,
              }),
              createAttachment({
                contentType: IMAGE_JPEG,
                fileName: 'tina-rolf-269345-unsplash.jpg',
                url: '/fixtures/tina-rolf-269345-unsplash.jpg',
              }),
              createAttachment({
                contentType: VIDEO_MP4,
                fileName: 'pixabay-Soap-Bubble-7141.mp4',
                url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
                screenshotPath: '/fixtures/kitten-4-112-112.jpg',
              }),
            ],
          }),
        ],
      })}
    />
  );
}

export function AnnouncementOnlyGroupsNonAdmin(): JSX.Element {
  return (
    <ForwardMessagesModal
      {...useProps()}
      candidateConversations={[
        getDefaultConversation({
          announcementsOnly: true,
          areWeAdmin: false,
        }),
      ]}
    />
  );
}
