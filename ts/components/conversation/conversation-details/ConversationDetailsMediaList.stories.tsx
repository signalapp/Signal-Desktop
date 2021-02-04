// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';

import {
  ConversationDetailsMediaList,
  Props,
} from './ConversationDetailsMediaList';
import {
  createPreparedMediaItems,
  createRandomMedia,
} from '../media-gallery/AttachmentSection.stories';
import { MediaItemType } from '../../LightboxGallery';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/ConversationMediaList',
  module
);

const createProps = (mediaItems?: Array<MediaItemType>): Props => ({
  conversation: getDefaultConversation({
    recentMediaItems: mediaItems || [],
  }),
  i18n,
  loadRecentMediaItems: action('loadRecentMediaItems'),
  showAllMedia: action('showAllMedia'),
  showLightboxForMedia: action('showLightboxForMedia'),
});

story.add('Basic', () => {
  const mediaItems = createPreparedMediaItems(createRandomMedia);
  const props = createProps(mediaItems);

  return <ConversationDetailsMediaList {...props} />;
});
