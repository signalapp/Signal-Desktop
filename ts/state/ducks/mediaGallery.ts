// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';

import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import { DataReader } from '../../sql/Client';
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
import { getMessageIdForLogging } from '../../util/idForLogging';
import { useBoundActions } from '../../hooks/useBoundActions';

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
import type { MessageAttributesType } from '../../model-types';

type MediaItemMessage = ReadonlyDeep<{
  attachments: Array<AttachmentType>;
  conversationId: string;
  id: string;
  receivedAt: number;
  receivedAtMs: number;
  sentAt: number;
}>;
type MediaType = ReadonlyDeep<{
  path: string;
  objectURL: string;
  thumbnailObjectUrl?: string;
  contentType: MIMEType;
  index: number;
  attachment: AttachmentType;
  message: MediaItemMessage;
}>;

export type MediaGalleryStateType = ReadonlyDeep<{
  conversationId: string | undefined;
  documents: ReadonlyArray<MediaItemType>;
  haveOldestDocument: boolean;
  haveOldestMedia: boolean;
  loading: boolean;
  media: ReadonlyArray<MediaType>;
}>;

const FETCH_CHUNK_COUNT = 50;

const INITIAL_LOAD = 'mediaGallery/INITIAL_LOAD';
const LOAD_MORE_MEDIA = 'mediaGallery/LOAD_MORE_MEDIA';
const LOAD_MORE_DOCUMENTS = 'mediaGallery/LOAD_MORE_DOCUMENTS';
const SET_LOADING = 'mediaGallery/SET_LOADING';

type InitialLoadActionType = ReadonlyDeep<{
  type: typeof INITIAL_LOAD;
  payload: {
    conversationId: string;
    documents: ReadonlyArray<MediaItemType>;
    media: ReadonlyArray<MediaType>;
  };
}>;
type LoadMoreMediaActionType = ReadonlyDeep<{
  type: typeof LOAD_MORE_MEDIA;
  payload: {
    conversationId: string;
    media: ReadonlyArray<MediaType>;
  };
}>;
type LoadMoreDocumentsActionType = ReadonlyDeep<{
  type: typeof LOAD_MORE_DOCUMENTS;
  payload: {
    conversationId: string;
    documents: ReadonlyArray<MediaItemType>;
  };
}>;
type SetLoadingActionType = ReadonlyDeep<{
  type: typeof SET_LOADING;
  payload: {
    loading: boolean;
  };
}>;

type MediaGalleryActionType = ReadonlyDeep<
  | ConversationUnloadedActionType
  | InitialLoadActionType
  | LoadMoreDocumentsActionType
  | LoadMoreMediaActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessageExpiredActionType
  | SetLoadingActionType
>;

function _getMediaItemMessage(
  message: ReadonlyDeep<MessageAttributesType>
): MediaItemMessage {
  return {
    attachments: message.attachments || [],
    conversationId:
      window.ConversationController.lookupOrCreate({
        serviceId: message.sourceServiceId,
        e164: message.source,
        reason: 'conversation_view.showAllMedia',
      })?.id || message.conversationId,
    id: message.id,
    receivedAt: message.received_at,
    receivedAtMs: Number(message.received_at_ms),
    sentAt: message.sent_at,
  };
}

function _cleanVisualAttachments(
  rawMedia: ReadonlyDeep<ReadonlyArray<MessageAttributesType>>
): ReadonlyArray<MediaType> {
  let index = 0;

  return rawMedia
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
            message: _getMediaItemMessage(message),
          };

          index += 1;

          return result;
        }
      );
    })
    .filter(isNotNil);
}

function _cleanFileAttachments(
  rawDocuments: ReadonlyDeep<ReadonlyArray<MessageAttributesType>>
): ReadonlyArray<MediaItemType> {
  return rawDocuments
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
          ..._getMediaItemMessage(message),
          attachments: [attachment],
        },
      };
    })
    .filter(isNotNil);
}

async function _upgradeMessages(
  messages: ReadonlyArray<MessageAttributesType>
): Promise<ReadonlyArray<MessageAttributesType>> {
  // We upgrade these messages so they are sure to have thumbnails
  const upgraded = await Promise.all(
    messages.map(async message => {
      try {
        return await window.MessageCache.upgradeSchema(
          message,
          VERSION_NEEDED_FOR_DISPLAY
        );
      } catch (error) {
        log.warn(
          '_upgradeMessages: Failed to upgrade message ' +
            `${getMessageIdForLogging(message)}: ${Errors.toLogFormat(error)}`
        );
        return undefined;
      }
    })
  );

  return upgraded.filter(isNotNil);
}

function initialLoad(
  conversationId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  InitialLoadActionType | SetLoadingActionType
> {
  return async dispatch => {
    dispatch({
      type: SET_LOADING,
      payload: { loading: true },
    });

    const rawMedia = await DataReader.getOlderMessagesByConversation({
      conversationId,
      includeStoryReplies: false,
      limit: FETCH_CHUNK_COUNT,
      requireVisualMediaAttachments: true,
      storyId: undefined,
    });
    const rawDocuments = await DataReader.getOlderMessagesByConversation({
      conversationId,
      includeStoryReplies: false,
      limit: FETCH_CHUNK_COUNT,
      requireFileAttachments: true,
      storyId: undefined,
    });

    const upgraded = await _upgradeMessages(rawMedia);
    const media = _cleanVisualAttachments(upgraded);

    const documents = _cleanFileAttachments(rawDocuments);

    dispatch({
      type: INITIAL_LOAD,
      payload: {
        conversationId,
        documents,
        media,
      },
    });
  };
}

function loadMoreMedia(
  conversationId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  InitialLoadActionType | LoadMoreMediaActionType | SetLoadingActionType
> {
  return async (dispatch, getState) => {
    const { conversationId: previousConversationId, media: previousMedia } =
      getState().mediaGallery;

    if (conversationId !== previousConversationId) {
      log.warn('loadMoreMedia: conversationId mismatch; calling initialLoad()');
      initialLoad(conversationId)(dispatch, getState, {});
      return;
    }

    const firstMedia = previousMedia[0];
    if (!firstMedia) {
      log.warn('loadMoreMedia: no previous media; calling initialLoad()');
      initialLoad(conversationId)(dispatch, getState, {});
      return;
    }

    dispatch({
      type: SET_LOADING,
      payload: { loading: true },
    });

    const { sentAt, receivedAt, id: messageId } = firstMedia.message;

    const rawMedia = await DataReader.getOlderMessagesByConversation({
      conversationId,
      includeStoryReplies: false,
      limit: FETCH_CHUNK_COUNT,
      messageId,
      receivedAt,
      requireVisualMediaAttachments: true,
      sentAt,
      storyId: undefined,
    });

    const upgraded = await _upgradeMessages(rawMedia);
    const media = _cleanVisualAttachments(upgraded);

    dispatch({
      type: LOAD_MORE_MEDIA,
      payload: {
        conversationId,
        media,
      },
    });
  };
}

function loadMoreDocuments(
  conversationId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  InitialLoadActionType | LoadMoreDocumentsActionType | SetLoadingActionType
> {
  return async (dispatch, getState) => {
    const {
      conversationId: previousConversationId,
      documents: previousDocuments,
    } = getState().mediaGallery;

    if (conversationId !== previousConversationId) {
      log.warn(
        'loadMoreDocuments: conversationId mismatch; calling initialLoad()'
      );
      initialLoad(conversationId)(dispatch, getState, {});
      return;
    }

    const firstDocument = previousDocuments[0];
    if (!firstDocument) {
      log.warn(
        'loadMoreDocuments: no previous documents; calling initialLoad()'
      );
      initialLoad(conversationId)(dispatch, getState, {});
      return;
    }

    dispatch({
      type: SET_LOADING,
      payload: { loading: true },
    });

    const { sentAt, receivedAt, id: messageId } = firstDocument.message;

    const rawDocuments = await DataReader.getOlderMessagesByConversation({
      conversationId,
      includeStoryReplies: false,
      limit: FETCH_CHUNK_COUNT,
      messageId,
      receivedAt,
      requireFileAttachments: true,
      sentAt,
      storyId: undefined,
    });

    const documents = _cleanFileAttachments(rawDocuments);

    dispatch({
      type: LOAD_MORE_DOCUMENTS,
      payload: {
        conversationId,
        documents,
      },
    });
  };
}

export const actions = {
  initialLoad,
  loadMoreMedia,
  loadMoreDocuments,
};

export const useMediaGalleryActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function getEmptyState(): MediaGalleryStateType {
  return {
    conversationId: undefined,
    documents: [],
    haveOldestDocument: false,
    haveOldestMedia: false,
    loading: true,
    media: [],
  };
}

export function reducer(
  state: Readonly<MediaGalleryStateType> = getEmptyState(),
  action: Readonly<MediaGalleryActionType>
): MediaGalleryStateType {
  if (action.type === SET_LOADING) {
    const { loading } = action.payload;

    return {
      ...state,
      loading,
    };
  }

  if (action.type === INITIAL_LOAD) {
    const { payload } = action;

    return {
      ...state,
      loading: false,
      ...payload,
      haveOldestMedia: payload.media.length === 0,
      haveOldestDocument: payload.documents.length === 0,
    };
  }

  if (action.type === LOAD_MORE_MEDIA) {
    const { conversationId, media } = action.payload;
    if (state.conversationId !== conversationId) {
      return state;
    }

    return {
      ...state,
      loading: false,
      haveOldestMedia: media.length === 0,
      media: media.concat(state.media),
    };
  }

  if (action.type === LOAD_MORE_DOCUMENTS) {
    const { conversationId, documents } = action.payload;
    if (state.conversationId !== conversationId) {
      return state;
    }

    return {
      ...state,
      loading: false,
      haveOldestDocument: documents.length === 0,
      documents: documents.concat(state.documents),
    };
  }

  // We don't capture the initial message add, but we do capture the moment when its
  // attachments have been downloaded
  if (action.type === MESSAGE_CHANGED) {
    const { payload } = action;
    const { conversationId, data: message } = payload;

    if (conversationId !== state.conversationId) {
      return state;
    }

    if (!message.attachments || message.attachments.length === 0) {
      return state;
    }

    const mediaWithout = state.media.filter(
      item => item.message.id !== message.id
    );
    const documentsWithout = state.documents.filter(
      item => item.message.id !== message.id
    );

    if (message.deletedForEveryone) {
      return {
        ...state,
        media: mediaWithout,
        documents: documentsWithout,
      };
    }

    // Check whether we have new downloaded media, or an attachment has been deleted
    const mediaCount = state.media.length - mediaWithout.length;
    const documentCount = state.documents.length - mediaWithout.length;

    const media = _cleanVisualAttachments([message]);
    const documents = _cleanFileAttachments([message]);

    if (mediaCount !== media.length || documentCount !== documents.length) {
      return {
        ...state,
        media: mediaWithout.concat(media),
        documents: documentsWithout.concat(documents),
      };
    }

    return state;
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
