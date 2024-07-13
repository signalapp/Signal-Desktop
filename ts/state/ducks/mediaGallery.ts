// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import type { AttachmentType } from '../../types/Attachment';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type {
  ConversationUnloadedActionType,
  MessageChangedActionType,
  MessageDeletedActionType,
  MessageExpiredActionType,
} from './conversations';
import type { MIMEType } from '../../types/MIME';
import type { MediaItemType } from '../../types/MediaItem';
import type { StateType as RootStateType } from '../reducer';

import dataInterface from '../../sql/Client';
import {
  CONVERSATION_UNLOADED,
  MESSAGE_CHANGED,
  MESSAGE_DELETED,
  MESSAGE_EXPIRED,
} from './conversations';
import { VERSION_NEEDED_FOR_DISPLAY } from '../../types/Message2';
import { isDownloading, hasFailed } from '../../types/Attachment';
import { isNotNil } from '../../util/isNotNil';
import { getLocalAttachmentUrl } from '../../util/getLocalAttachmentUrl';
import { useBoundActions } from '../../hooks/useBoundActions';

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type MediaType = {
  path: string;
  objectURL: string;
  thumbnailObjectUrl?: string;
  contentType: MIMEType;
  index: number;
  attachment: AttachmentType;
  message: {
    attachments: Array<AttachmentType>;
    conversationId: string;
    id: string;
    received_at: number;
    received_at_ms: number;
    sent_at: number;
  };
};

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type MediaGalleryStateType = {
  documents: Array<MediaItemType>;
  media: Array<MediaType>;
};

const LOAD_MEDIA_ITEMS = 'mediaGallery/LOAD_MEDIA_ITEMS';

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type LoadMediaItemslActionType = {
  type: typeof LOAD_MEDIA_ITEMS;
  payload: {
    documents: Array<MediaItemType>;
    media: Array<MediaType>;
  };
};

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type MediaGalleryActionType =
  | ConversationUnloadedActionType
  | LoadMediaItemslActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessageExpiredActionType;

function loadMediaItems(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, LoadMediaItemslActionType> {
  return async dispatch => {
    const { upgradeMessageSchema } = window.Signal.Migrations;

    // We fetch more documents than media as they don’t require to be loaded
    // into memory right away. Revisit this once we have infinite scrolling:
    const DEFAULT_MEDIA_FETCH_COUNT = 50;
    const DEFAULT_DOCUMENTS_FETCH_COUNT = 150;

    const ourAci = window.textsecure.storage.user.getCheckedAci();

    const rawMedia = await dataInterface.getMessagesWithVisualMediaAttachments(
      conversationId,
      {
        limit: DEFAULT_MEDIA_FETCH_COUNT,
      }
    );
    const rawDocuments = await dataInterface.getMessagesWithFileAttachments(
      conversationId,
      {
        limit: DEFAULT_DOCUMENTS_FETCH_COUNT,
      }
    );

    // First we upgrade these messages to ensure that they have thumbnails
    await Promise.all(
      rawMedia.map(async message => {
        const { schemaVersion } = message;
        const model = window.MessageCache.__DEPRECATED$register(
          message.id,
          message,
          'loadMediaItems'
        );

        if (schemaVersion && schemaVersion < VERSION_NEEDED_FOR_DISPLAY) {
          const upgradedMsgAttributes = await upgradeMessageSchema(message);
          model.set(upgradedMsgAttributes);

          await dataInterface.saveMessage(upgradedMsgAttributes, { ourAci });
        }
      })
    );

    let index = 0;
    const media: Array<MediaType> = rawMedia
      .flatMap(message => {
        return (message.attachments || []).map(
          (attachment: AttachmentType): MediaType | undefined => {
            if (
              !attachment.path ||
              !attachment.thumbnail ||
              isDownloading(attachment) ||
              hasFailed(attachment)
            ) {
              return;
            }

            const { thumbnail } = attachment;
            const result = {
              path: attachment.path,
              objectURL: getLocalAttachmentUrl(attachment),
              thumbnailObjectUrl: thumbnail?.path
                ? getLocalAttachmentUrl(thumbnail)
                : undefined,
              contentType: attachment.contentType,
              index,
              attachment,
              message: {
                attachments: message.attachments || [],
                conversationId:
                  window.ConversationController.lookupOrCreate({
                    serviceId: message.sourceServiceId,
                    e164: message.source,
                    reason: 'conversation_view.showAllMedia',
                  })?.id || message.conversationId,
                id: message.id,
                received_at: message.received_at,
                received_at_ms: Number(message.received_at_ms),
                sent_at: message.sent_at,
              },
            };

            index += 1;

            return result;
          }
        );
      })
      .filter(isNotNil);

    // Unlike visual media, only one non-image attachment is supported
    const documents: Array<MediaItemType> = rawDocuments
      .map(message => {
        const attachments = message.attachments || [];
        const attachment = attachments[0];
        if (!attachment) {
          return;
        }

        return {
          contentType: attachment.contentType,
          index: 0,
          attachment,
          message: {
            ...message,
            attachments: [attachment],
          },
        };
      })
      .filter(isNotNil);

    dispatch({
      type: LOAD_MEDIA_ITEMS,
      payload: {
        documents,
        media,
      },
    });
  };
}

export const actions = {
  loadMediaItems,
};

export const useMediaGalleryActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function getEmptyState(): MediaGalleryStateType {
  return {
    documents: [],
    media: [],
  };
}

export function reducer(
  state: Readonly<MediaGalleryStateType> = getEmptyState(),
  action: Readonly<MediaGalleryActionType>
): MediaGalleryStateType {
  if (action.type === LOAD_MEDIA_ITEMS) {
    return {
      ...state,
      ...action.payload,
    };
  }

  if (action.type === MESSAGE_CHANGED) {
    if (!action.payload.data.deletedForEveryone) {
      return state;
    }

    return {
      ...state,
      media: state.media.filter(item => item.message.id !== action.payload.id),
      documents: state.documents.filter(
        item => item.message.id !== action.payload.id
      ),
    };
  }

  if (action.type === MESSAGE_DELETED || action.type === MESSAGE_EXPIRED) {
    return {
      ...state,
      media: state.media.filter(item => item.message.id !== action.payload.id),
      documents: state.documents.filter(
        item => item.message.id !== action.payload.id
      ),
    };
  }

  if (action.type === CONVERSATION_UNLOADED) {
    return getEmptyState();
  }

  return state;
}
