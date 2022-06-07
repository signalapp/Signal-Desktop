// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

import enMessages from '../../_locales/en/messages.json';
import type { AttachmentType } from '../types/Attachment';
import type { PropsType } from './ForwardMessageModal';
import { ForwardMessageModal } from './ForwardMessageModal';
import { IMAGE_JPEG, VIDEO_MP4, stringToMIMEType } from '../types/MIME';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';

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
  attachments: overrideProps.attachments,
  candidateConversations,
  doForwardMessage: action('doForwardMessage'),
  getPreferredBadge: () => undefined,
  i18n,
  hasContact: Boolean(overrideProps.hasContact),
  isSticker: Boolean(overrideProps.isSticker),
  linkPreview: overrideProps.linkPreview,
  messageBody: text('messageBody', overrideProps.messageBody || ''),
  onClose: action('onClose'),
  onEditorStateChange: action('onEditorStateChange'),
  onPickEmoji: action('onPickEmoji'),
  onTextTooLong: action('onTextTooLong'),
  onSetSkinTone: action('onSetSkinTone'),
  recentEmojis: [],
  removeLinkPreview: action('removeLinkPreview'),
  skinTone: 0,
  theme: React.useContext(StorybookThemeContext),
  regionCode: 'US',
});

export const Modal = (): JSX.Element => {
  return <ForwardMessageModal {...useProps()} />;
};

export const WithText = (): JSX.Element => {
  return <ForwardMessageModal {...useProps({ messageBody: 'sup' })} />;
};

WithText.story = {
  name: 'with text',
};

export const ASticker = (): JSX.Element => {
  return <ForwardMessageModal {...useProps({ isSticker: true })} />;
};

ASticker.story = {
  name: 'a sticker',
};

export const WithAContact = (): JSX.Element => {
  return <ForwardMessageModal {...useProps({ hasContact: true })} />;
};

WithAContact.story = {
  name: 'with a contact',
};

export const LinkPreview = (): JSX.Element => {
  return (
    <ForwardMessageModal
      {...useProps({
        linkPreview: {
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
        messageBody: 'signal.org',
      })}
    />
  );
};

LinkPreview.story = {
  name: 'link preview',
};

export const MediaAttachments = (): JSX.Element => {
  return (
    <ForwardMessageModal
      {...useProps({
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
        messageBody: 'cats',
      })}
    />
  );
};

MediaAttachments.story = {
  name: 'media attachments',
};

export const AnnouncementOnlyGroupsNonAdmin = (): JSX.Element => (
  <ForwardMessageModal
    {...useProps()}
    candidateConversations={[
      getDefaultConversation({
        announcementsOnly: true,
        areWeAdmin: false,
      }),
    ]}
  />
);

AnnouncementOnlyGroupsNonAdmin.story = {
  name: 'announcement only groups non-admin',
};
