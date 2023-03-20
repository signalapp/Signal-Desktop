// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

import enMessages from '../../_locales/en/messages.json';
import type { AttachmentType } from '../types/Attachment';
import type { PropsType } from './ForwardMessagesModal';
import { ForwardMessagesModal } from './ForwardMessagesModal';
import { IMAGE_JPEG, VIDEO_MP4, stringToMIMEType } from '../types/MIME';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import { CompositionTextArea } from './CompositionTextArea';
import type { MessageForwardDraft } from '../util/maybeForwardMessages';

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  pending: false,
  path: 'fileName.jpg',
  contentType: stringToMIMEType(
    text('attachment contentType', props.contentType || '')
  ),
  fileName: text('attachment fileName', props.fileName || ''),
  screenshotPath: props.pending === false ? props.screenshotPath : undefined,
  url: text('attachment url', props.pending === false ? props.url || '' : ''),
  size: 3433,
});

export default {
  title: 'Components/ForwardMessageModal',
};

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
  linkPreviewForSource: () => undefined,
  onClose: action('onClose'),
  onChange: action('onChange'),
  removeLinkPreview: action('removeLinkPreview'),
  RenderCompositionTextArea: props => (
    <CompositionTextArea
      {...props}
      i18n={i18n}
      onPickEmoji={action('onPickEmoji')}
      skinTone={0}
      onSetSkinTone={action('onSetSkinTone')}
      onTextTooLong={action('onTextTooLong')}
      getPreferredBadge={() => undefined}
    />
  ),
  showToast: action('showToast'),
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
    messageBody: text('messageBody', overrideProps.messageBody || ''),
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

WithText.story = {
  name: 'with text',
};

export function ASticker(): JSX.Element {
  return (
    <ForwardMessagesModal
      {...useProps({
        drafts: [getMessageForwardDraft({ isSticker: true })],
      })}
    />
  );
}

ASticker.story = {
  name: 'a sticker',
};

export function WithAContact(): JSX.Element {
  return (
    <ForwardMessagesModal
      {...useProps({
        drafts: [getMessageForwardDraft({ hasContact: true })],
      })}
    />
  );
}

WithAContact.story = {
  name: 'with a contact',
};

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
                title: LONG_TITLE,
              },
            ],
          }),
        ],
      })}
    />
  );
}

LinkPreview.story = {
  name: 'link preview',
};

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

MediaAttachments.story = {
  name: 'media attachments',
};

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

AnnouncementOnlyGroupsNonAdmin.story = {
  name: 'announcement only groups non-admin',
};
