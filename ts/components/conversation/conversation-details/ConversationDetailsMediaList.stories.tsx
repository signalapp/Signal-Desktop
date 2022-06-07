// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';

import type { Props } from './ConversationDetailsMediaList';
import { ConversationDetailsMediaList } from './ConversationDetailsMediaList';
import {
  createPreparedMediaItems,
  createRandomMedia,
} from '../media-gallery/AttachmentSection.stories';
import type { MediaItemType } from '../../../types/MediaItem';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ConversationDetails/ConversationMediaList',
};

const createProps = (mediaItems?: Array<MediaItemType>): Props => ({
  conversation: getDefaultConversation({
    recentMediaItems: mediaItems || [],
  }),
  i18n,
  loadRecentMediaItems: action('loadRecentMediaItems'),
  showAllMedia: action('showAllMedia'),
  showLightboxForMedia: action('showLightboxForMedia'),
});

export const Basic = (): JSX.Element => {
  const mediaItems = createPreparedMediaItems(createRandomMedia);
  const props = createProps(mediaItems);

  return <ConversationDetailsMediaList {...props} />;
};
