// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';

import { createLogger } from '../../logging/log.std.js';
import { DataReader } from '../../sql/Client.preload.js';
import type {
  MediaItemDBType,
  LinkPreviewMediaItemDBType,
} from '../../sql/Interface.std.js';
import {
  CONVERSATION_UNLOADED,
  MESSAGE_CHANGED,
  MESSAGE_DELETED,
  MESSAGE_EXPIRED,
} from './conversations.preload.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import type {
  ConversationUnloadedActionType,
  MessageChangedActionType,
  MessageDeletedActionType,
  MessageExpiredActionType,
} from './conversations.preload.js';
import type {
  MediaItemMessageType,
  MediaItemType,
  LinkPreviewMediaItemType,
} from '../../types/MediaItem.std.js';
import { isFile, isVisualMedia } from '../../util/Attachment.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import type { StateType as RootStateType } from '../reducer.preload.js';
import { getPropsForAttachment } from '../selectors/message.preload.js';

const { orderBy } = lodash;

const log = createLogger('mediaGallery');

export type MediaGalleryStateType = ReadonlyDeep<{
  conversationId: string | undefined;
  haveOldestDocument: boolean;
  haveOldestMedia: boolean;
  haveOldestLink: boolean;
  loading: boolean;
  media: ReadonlyArray<MediaItemType>;
  documents: ReadonlyArray<MediaItemType>;
  links: ReadonlyArray<LinkPreviewMediaItemType>;
}>;

const FETCH_CHUNK_COUNT = 50;

const INITIAL_LOAD = 'mediaGallery/INITIAL_LOAD';
const LOAD_MORE = 'mediaGallery/LOAD_MORE';
const SET_LOADING = 'mediaGallery/SET_LOADING';

type InitialLoadActionType = ReadonlyDeep<{
  type: typeof INITIAL_LOAD;
  payload: {
    conversationId: string;
    documents: ReadonlyArray<MediaItemType>;
    media: ReadonlyArray<MediaItemType>;
    links: ReadonlyArray<LinkPreviewMediaItemType>;
  };
}>;
type LoadMoreActionType = ReadonlyDeep<{
  type: typeof LOAD_MORE;
  payload: {
    conversationId: string;
    media: ReadonlyArray<MediaItemType>;
    documents: ReadonlyArray<MediaItemType>;
    links: ReadonlyArray<LinkPreviewMediaItemType>;
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
  | LoadMoreActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessageExpiredActionType
  | SetLoadingActionType
>;

function _sortItems<
  Item extends ReadonlyDeep<{ message: MediaItemMessageType }>,
>(items: ReadonlyArray<Item>): ReadonlyArray<Item> {
  return orderBy(items, [
    'message.receivedAt',
    'message.sentAt',
    'message.index',
  ]);
}

function _cleanAttachments(
  type: 'media' | 'document',
  rawMedia: ReadonlyArray<MediaItemDBType>
): ReadonlyArray<MediaItemType> {
  return rawMedia.map(({ message, index, attachment }) => {
    return {
      type,
      index,
      attachment: getPropsForAttachment(attachment, 'attachment', message),
      message,
    };
  });
}

function _cleanLinkPreviews(
  rawPreviews: ReadonlyArray<LinkPreviewMediaItemDBType>
): ReadonlyArray<LinkPreviewMediaItemType> {
  return rawPreviews.map(({ message, preview }) => {
    return {
      type: 'link',
      preview: {
        ...preview,
        image:
          preview.image == null
            ? undefined
            : getPropsForAttachment(preview.image, 'preview', message),
      },
      message,
    };
  });
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

    const [rawMedia, rawDocuments, rawLinkPreviews] = await Promise.all([
      DataReader.getOlderMedia({
        conversationId,
        limit: FETCH_CHUNK_COUNT,
        type: 'media',
      }),
      DataReader.getOlderMedia({
        conversationId,
        limit: FETCH_CHUNK_COUNT,
        type: 'documents',
      }),
      DataReader.getOlderLinkPreviews({
        conversationId,
        limit: FETCH_CHUNK_COUNT,
      }),
    ]);

    const media = _cleanAttachments('media', rawMedia);
    const documents = _cleanAttachments('document', rawDocuments);
    const links = _cleanLinkPreviews(rawLinkPreviews);

    dispatch({
      type: INITIAL_LOAD,
      payload: {
        conversationId,
        documents,
        media,
        links,
      },
    });
  };
}

function loadMore(
  conversationId: string,
  type: 'media' | 'documents' | 'links'
): ThunkAction<
  void,
  RootStateType,
  unknown,
  InitialLoadActionType | LoadMoreActionType | SetLoadingActionType
> {
  return async (dispatch, getState) => {
    const { mediaGallery } = getState();
    const { conversationId: previousConversationId } = mediaGallery;

    if (conversationId !== previousConversationId) {
      log.warn('loadMore: conversationId mismatch; calling initialLoad()');
      initialLoad(conversationId)(dispatch, getState, {});
      return;
    }

    let previousItems: ReadonlyArray<MediaItemType | LinkPreviewMediaItemType>;
    if (type === 'media') {
      previousItems = mediaGallery.media;
    } else if (type === 'documents') {
      previousItems = mediaGallery.documents;
    } else if (type === 'links') {
      previousItems = mediaGallery.links;
    } else {
      throw missingCaseError(type);
    }

    const oldestLoadedItem = previousItems[0];
    if (!oldestLoadedItem) {
      log.warn('loadMore: no previous media; calling initialLoad()');
      initialLoad(conversationId)(dispatch, getState, {});
      return;
    }

    dispatch({
      type: SET_LOADING,
      payload: { loading: true },
    });

    const { sentAt, receivedAt, id: messageId } = oldestLoadedItem.message;

    const sharedOptions = {
      conversationId,
      limit: FETCH_CHUNK_COUNT,
      messageId,
      receivedAt,
      sentAt,
    };

    let media: ReadonlyArray<MediaItemType> = [];
    let documents: ReadonlyArray<MediaItemType> = [];
    let links: ReadonlyArray<LinkPreviewMediaItemType> = [];
    if (type === 'media') {
      const rawMedia = await DataReader.getOlderMedia({
        ...sharedOptions,
        type: 'media',
      });

      media = _cleanAttachments('media', rawMedia);
    } else if (type === 'documents') {
      const rawDocuments = await DataReader.getOlderMedia({
        ...sharedOptions,
        type: 'documents',
      });
      documents = _cleanAttachments('document', rawDocuments);
    } else if (type === 'links') {
      const rawPreviews = await DataReader.getOlderLinkPreviews(sharedOptions);
      links = _cleanLinkPreviews(rawPreviews);
    } else {
      throw missingCaseError(type);
    }

    dispatch({
      type: LOAD_MORE,
      payload: {
        conversationId,
        media,
        documents,
        links,
      },
    });
  };
}

export const actions = {
  initialLoad,
  loadMore,
};

export const useMediaGalleryActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function getEmptyState(): MediaGalleryStateType {
  return {
    conversationId: undefined,
    haveOldestDocument: false,
    haveOldestMedia: false,
    haveOldestLink: false,
    loading: true,
    media: [],
    documents: [],
    links: [],
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
      haveOldestMedia: payload.media.length === 0,
      haveOldestDocument: payload.documents.length === 0,
      haveOldestLink: payload.links.length === 0,
      media: _sortItems(payload.media),
      documents: _sortItems(payload.documents),
      links: _sortItems(payload.links),
    };
  }

  if (action.type === LOAD_MORE) {
    const { conversationId, media, documents, links } = action.payload;
    if (state.conversationId !== conversationId) {
      return state;
    }

    return {
      ...state,
      loading: false,
      haveOldestMedia: media.length === 0,
      haveOldestDocument: documents.length === 0,
      haveOldestLink: links.length === 0,
      media: _sortItems(media.concat(state.media)),
      documents: _sortItems(documents.concat(state.documents)),
      links: _sortItems(links.concat(state.links)),
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
    const linksWithout = state.links.filter(
      item => item.message.id !== message.id
    );
    const mediaDifference = state.media.length - mediaWithout.length;
    const documentDifference = state.documents.length - documentsWithout.length;
    const linkDifference = state.links.length - linksWithout.length;

    if (message.deletedForEveryone || message.isErased) {
      if (mediaDifference > 0 || documentDifference > 0) {
        return {
          ...state,
          media: mediaWithout,
          documents: documentsWithout,
          links: linksWithout,
        };
      }
      return state;
    }

    const oldestLoadedMedia = state.media[0];
    const oldestLoadedDocument = state.documents[0];
    const oldestLoadedLink = state.links[0];

    const messageMediaItems: Array<MediaItemDBType> = (
      message.attachments ?? []
    ).map((attachment, index) => {
      return {
        index,
        attachment,
        message: {
          id: message.id,
          type: message.type,
          source: message.source,
          sourceServiceId: message.sourceServiceId,
          conversationId: message.conversationId,
          receivedAt: message.received_at,
          receivedAtMs: message.received_at_ms,
          sentAt: message.sent_at,
        },
      };
    });

    const newMedia = _cleanAttachments(
      'media',
      messageMediaItems.filter(({ attachment }) => isVisualMedia(attachment))
    );
    const newDocuments = _cleanAttachments(
      'document',
      messageMediaItems.filter(({ attachment }) => isFile(attachment))
    );
    const newLinks = _cleanLinkPreviews(
      message.preview != null && message.preview.length > 0
        ? [
            {
              preview: message.preview[0],
              message: {
                id: message.id,
                type: message.type,
                source: message.source,
                sourceServiceId: message.sourceServiceId,
                conversationId: message.conversationId,
                receivedAt: message.received_at,
                receivedAtMs: message.received_at_ms,
                sentAt: message.sent_at,
              },
            },
          ]
        : []
    );

    let {
      documents,
      haveOldestDocument,
      haveOldestMedia,
      media,
      haveOldestLink,
      links,
    } = state;

    const inMediaTimeRange =
      !oldestLoadedMedia ||
      (message.received_at >= oldestLoadedMedia.message.receivedAt &&
        message.sent_at >= oldestLoadedMedia.message.sentAt);
    if (mediaDifference !== media.length && inMediaTimeRange) {
      media = _sortItems(mediaWithout.concat(newMedia));
    } else if (!inMediaTimeRange) {
      haveOldestMedia = false;
    }

    const inDocumentTimeRange =
      !oldestLoadedDocument ||
      (message.received_at >= oldestLoadedDocument.message.receivedAt &&
        message.sent_at >= oldestLoadedDocument.message.sentAt);
    if (documentDifference !== documents.length && inDocumentTimeRange) {
      documents = _sortItems(documentsWithout.concat(newDocuments));
    } else if (!inDocumentTimeRange) {
      haveOldestDocument = false;
    }

    const inLinkTimeRange =
      !oldestLoadedLink ||
      (message.received_at >= oldestLoadedLink.message.receivedAt &&
        message.sent_at >= oldestLoadedLink.message.sentAt);
    if (linkDifference !== links.length && inLinkTimeRange) {
      links = _sortItems(linksWithout.concat(newLinks));
    } else if (!inLinkTimeRange) {
      haveOldestLink = false;
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
        haveOldestLink,
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
