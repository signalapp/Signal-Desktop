// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { orderBy } from 'lodash';
import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';

import { createLogger } from '../../logging/log';
import { DataReader } from '../../sql/Client';
import type { MediaItemDBType } from '../../sql/Interface';
import {
  CONVERSATION_UNLOADED,
  MESSAGE_CHANGED,
  MESSAGE_DELETED,
  MESSAGE_EXPIRED,
} from './conversations';
import { isNotNil } from '../../util/isNotNil';
import { useBoundActions } from '../../hooks/useBoundActions';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type {
  ConversationUnloadedActionType,
  MessageChangedActionType,
  MessageDeletedActionType,
  MessageExpiredActionType,
} from './conversations';
import type { MediaItemType } from '../../types/MediaItem';
import type { StateType as RootStateType } from '../reducer';
import type { MessageAttributesType, MessageType } from '../../model-types';
import { isTapToView, getPropsForAttachment } from '../selectors/message';

const log = createLogger('mediaGallery');

type MediaItemMessage = ReadonlyDeep<{
  // Note that this reflects the sender, and not the parent conversation
  conversationId: string;
  type: MessageType;
  id: string;
  receivedAt: number;
  receivedAtMs: number;
  sentAt: number;
}>;

export type MediaGalleryStateType = ReadonlyDeep<{
  conversationId: string | undefined;
  documents: ReadonlyArray<MediaItemType>;
  haveOldestDocument: boolean;
  haveOldestMedia: boolean;
  loading: boolean;
  media: ReadonlyArray<MediaItemType>;
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
    media: ReadonlyArray<MediaItemType>;
  };
}>;
type LoadMoreMediaActionType = ReadonlyDeep<{
  type: typeof LOAD_MORE_MEDIA;
  payload: {
    conversationId: string;
    media: ReadonlyArray<MediaItemType>;
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

function _sortMedia(
  media: ReadonlyArray<MediaItemType>
): ReadonlyArray<MediaItemType> {
  return orderBy(media, [
    'message.receivedAt',
    'message.sentAt',
    'message.index',
  ]);
}
function _sortDocuments(
  documents: ReadonlyArray<MediaItemType>
): ReadonlyArray<MediaItemType> {
  return orderBy(documents, ['message.receivedAt', 'message.sentAt']);
}

function _getMediaItemMessage(
  message: ReadonlyDeep<MessageAttributesType>
): MediaItemMessage {
  return {
    conversationId:
      window.ConversationController.lookupOrCreate({
        serviceId: message.sourceServiceId,
        e164: message.source,
        reason: 'conversation_view.showAllMedia',
      })?.id || message.conversationId,
    type: message.type,
    id: message.id,
    receivedAt: message.received_at,
    receivedAtMs: Number(message.received_at_ms),
    sentAt: message.sent_at,
  };
}

function _cleanVisualAttachments(
  rawMedia: ReadonlyArray<MediaItemDBType>
): ReadonlyArray<MediaItemType> {
  return rawMedia.map(({ message, index, attachment }) => {
    return {
      index,
      attachment: getPropsForAttachment(attachment, 'attachment', message),
      message,
    };
  });
}

function _cleanFileAttachments(
  rawDocuments: ReadonlyDeep<ReadonlyArray<MessageAttributesType>>
): ReadonlyArray<MediaItemType> {
  return rawDocuments
    .map(message => {
      if (isTapToView(message)) {
        return;
      }

      const attachments = message.attachments || [];
      const attachment = attachments[0];
      if (!attachment) {
        return;
      }

      return {
        index: 0,
        attachment: getPropsForAttachment(attachment, 'attachment', message),
        message: _getMediaItemMessage(message),
      };
    })
    .filter(isNotNil);
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

    const rawMedia = await DataReader.getOlderMedia({
      conversationId,
      limit: FETCH_CHUNK_COUNT,
    });
    const rawDocuments = await DataReader.getOlderMessagesByConversation({
      conversationId,
      includeStoryReplies: false,
      limit: FETCH_CHUNK_COUNT,
      requireFileAttachments: true,
      storyId: undefined,
    });

    const media = _cleanVisualAttachments(rawMedia);
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

    const oldestLoadedMedia = previousMedia[0];
    if (!oldestLoadedMedia) {
      log.warn('loadMoreMedia: no previous media; calling initialLoad()');
      initialLoad(conversationId)(dispatch, getState, {});
      return;
    }

    dispatch({
      type: SET_LOADING,
      payload: { loading: true },
    });

    const { sentAt, receivedAt, id: messageId } = oldestLoadedMedia.message;

    const rawMedia = await DataReader.getOlderMedia({
      conversationId,
      limit: FETCH_CHUNK_COUNT,
      messageId,
      receivedAt,
      sentAt,
    });

    const media = _cleanVisualAttachments(rawMedia);

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

    const oldestLoadedDocument = previousDocuments[0];
    if (!oldestLoadedDocument) {
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

    const { sentAt, receivedAt, id: messageId } = oldestLoadedDocument.message;

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
      conversationId: payload.conversationId,
      media: _sortMedia(payload.media),
      documents: _sortDocuments(payload.documents),
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
      media: _sortMedia(media.concat(state.media)),
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
      documents: _sortDocuments(documents.concat(state.documents)),
    };
  }

  // A time-ordered subset of all conversation media is loaded at once.
  // When a message changes, check that the changed message falls within this time range,
  // and if so insert it into the loaded media.
  if (action.type === MESSAGE_CHANGED) {
    const { payload } = action;
    const { conversationId, data: message } = payload;

    if (conversationId !== state.conversationId) {
      return state;
    }

    const mediaWithout = state.media.filter(
      item => item.message.id !== message.id
    );
    const documentsWithout = state.documents.filter(
      item => item.message.id !== message.id
    );
    const mediaDifference = state.media.length - mediaWithout.length;
    const documentDifference = state.documents.length - documentsWithout.length;

    if (message.deletedForEveryone || message.isErased) {
      if (mediaDifference > 0 || documentDifference > 0) {
        return {
          ...state,
          media: mediaWithout,
          documents: documentsWithout,
        };
      }
      return state;
    }

    const oldestLoadedMedia = state.media[0];
    const oldestLoadedDocument = state.documents[0];

    const newMedia = _cleanVisualAttachments(
      (message.attachments ?? []).map((attachment, index) => {
        return {
          index,
          attachment,
          message: {
            id: message.id,
            type: message.type,
            conversationId: message.conversationId,
            receivedAt: message.received_at,
            receivedAtMs: message.received_at_ms,
            sentAt: message.sent_at,
          },
        };
      })
    );
    const newDocuments = _cleanFileAttachments([message]);

    let { documents, haveOldestDocument, haveOldestMedia, media } = state;

    const inMediaTimeRange =
      !oldestLoadedMedia ||
      (message.received_at >= oldestLoadedMedia.message.receivedAt &&
        message.sent_at >= oldestLoadedMedia.message.sentAt);
    if (mediaDifference !== media.length && inMediaTimeRange) {
      media = _sortMedia(mediaWithout.concat(newMedia));
    } else if (!inMediaTimeRange) {
      haveOldestMedia = false;
    }

    const inDocumentTimeRange =
      !oldestLoadedDocument ||
      (message.received_at >= oldestLoadedDocument.message.receivedAt &&
        message.sent_at >= oldestLoadedDocument.message.sentAt);
    if (documentDifference !== documents.length && inDocumentTimeRange) {
      documents = _sortDocuments(documentsWithout.concat(newDocuments));
    } else if (!inDocumentTimeRange) {
      haveOldestDocument = false;
    }

    if (
      state.haveOldestDocument !== haveOldestDocument ||
      state.haveOldestMedia !== haveOldestMedia ||
      state.documents !== documents ||
      state.media !== media
    ) {
      return {
        ...state,
        documents,
        haveOldestDocument,
        haveOldestMedia,
        media,
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
