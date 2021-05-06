// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

import enMessages from '../../_locales/en/messages.json';
import { AttachmentType } from '../types/Attachment';
import { ForwardMessageModal, PropsType } from './ForwardMessageModal';
import { IMAGE_JPEG, MIMEType, VIDEO_MP4 } from '../types/MIME';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setup as setupI18n } from '../../js/modules/i18n';

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  contentType: text(
    'attachment contentType',
    props.contentType || ''
  ) as MIMEType,
  fileName: text('attachment fileName', props.fileName || ''),
  screenshot: props.screenshot,
  url: text('attachment url', props.url || ''),
});

const story = storiesOf('Components/ForwardMessageModal', module);

const i18n = setupI18n('en', enMessages);

const LONG_TITLE =
  "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?";
const LONG_DESCRIPTION =
  "You're gonna love this description. Not only does it have a lot of characters, but it will also be truncated in the UI. How cool is that??";
const candidateConversations = Array.from(Array(100), () =>
  getDefaultConversation()
);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  attachments: overrideProps.attachments,
  candidateConversations,
  doForwardMessage: action('doForwardMessage'),
  i18n,
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
  setSecureInput: action('setSecureInput'),
  skinTone: 0,
});

story.add('Modal', () => {
  return <ForwardMessageModal {...createProps()} />;
});

story.add('with text', () => {
  return <ForwardMessageModal {...createProps({ messageBody: 'sup' })} />;
});

story.add('a sticker', () => {
  return <ForwardMessageModal {...createProps({ isSticker: true })} />;
});

story.add('link preview', () => {
  return (
    <ForwardMessageModal
      {...createProps({
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
});

story.add('media attachments', () => {
  return (
    <ForwardMessageModal
      {...createProps({
        attachments: [
          createAttachment({
            contentType: IMAGE_JPEG,
            fileName: 'tina-rolf-269345-unsplash.jpg',
            url: '/fixtures/tina-rolf-269345-unsplash.jpg',
          }),
          createAttachment({
            contentType: VIDEO_MP4,
            fileName: 'pixabay-Soap-Bubble-7141.mp4',
            url: '/fixtures/pixabay-Soap-Bubble-7141.mp4',
            screenshot: {
              height: 112,
              width: 112,
              url: '/fixtures/kitten-4-112-112.jpg',
              contentType: IMAGE_JPEG,
            },
          }),
        ],
        messageBody: 'cats',
      })}
    />
  );
});
