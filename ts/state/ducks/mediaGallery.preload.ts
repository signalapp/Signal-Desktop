// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';

import type { ReadonlyMessageAttributesType } from '../../model-types.d.ts';
import { createLogger } from '../../logging/log.std.js';
import { DataReader } from '../../sql/Client.preload.js';
import type {
  MediaItemDBType,
  NonAttachmentMediaItemDBType,
  ContactMediaItemDBType,
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
  MediaTabType,
  MediaSortOrderType,
  MediaItemMessageType,
  MediaItemType,
  LinkPreviewMediaItemType,
  ContactMediaItemType,
  GenericMediaItemType,
} from '../../types/MediaItem.std.js';
import type { AttachmentForUIType } from '../../types/Attachment.std.js';
import {
  isFile,
  isVisualMedia,
  isVoiceMessage,
  isAudio,
} from '../../util/Attachment.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { strictAssert } from '../../util/assert.std.js';
import type { StateType as RootStateType } from '../reducer.preload.js';
import { getPropsForAttachment } from '../selectors/message.preload.js';

const { orderBy } = lodash;

const log = createLogger('mediaGallery');

export type MediaGalleryStateType = ReadonlyDeep<{
  tab: MediaTabType;
  sortOrder: MediaSortOrderType;
  conversationId: string | undefined;
  haveOldestMedia: boolean;
  haveOldestAudio: boolean;
  haveOldestLink: boolean;
  haveOldestDocument: boolean;
  loading: boolean;
  media: ReadonlyArray<MediaItemType>;
  audio: ReadonlyArray<MediaItemType>;
  links: ReadonlyArray<LinkPreviewMediaItemType>;
  documents: ReadonlyArray<MediaItemType | ContactMediaItemType>;
}>;

const FETCH_CHUNK_COUNT = 50;

const INITIAL_LOAD = 'mediaGallery/INITIAL_LOAD';
const LOAD_MORE = 'mediaGallery/LOAD_MORE';
const SET_LOADING = 'mediaGallery/SET_LOADING';
const SET_TAB = 'mediaGallery/SET_TAB';
const SET_SORT_ORDER = 'mediaGallery/SET_SORT_ORDER';

type InitialLoadActionType = ReadonlyDeep<{
  type: typeof INITIAL_LOAD;
  payload: {
    conversationId: string;
    media: ReadonlyArray<MediaItemType>;
    audio: ReadonlyArray<MediaItemType>;
    links: ReadonlyArray<LinkPreviewMediaItemType>;
    documents: ReadonlyArray<MediaItemType | ContactMediaItemType>;
  };
}>;
type LoadMoreActionType = ReadonlyDeep<{
  type: typeof LOAD_MORE;
  payload: {
    conversationId: string;
    media: ReadonlyArray<MediaItemType>;
    audio: ReadonlyArray<MediaItemType>;
    links: ReadonlyArray<LinkPreviewMediaItemType>;
    documents: ReadonlyArray<MediaItemType | ContactMediaItemType>;
  };
}>;
type SetLoadingActionType = ReadonlyDeep<{
  type: typeof SET_LOADING;
  payload: {
    loading: boolean;
  };
}>;
type SetTabActionType = ReadonlyDeep<{
  type: typeof SET_TAB;
  payload: {
    tab: MediaGalleryStateType['tab'];
  };
}>;
type SetSortOrderActionType = ReadonlyDeep<{
  type: typeof SET_SORT_ORDER;
  payload: {
    sortOrder: MediaGalleryStateType['sortOrder'];
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
  | SetTabActionType
  | SetSortOrderActionType
>;

function getMediaItemSize(item: GenericMediaItemType): number {
  switch (item.type) {
    case 'media':
    case 'audio':
    case 'document':
      return item.attachment.size;
    case 'link':
    case 'contact':
      return 0;
    default:
      throw missingCaseError(item);
  }
}

function _updateMedia<ItemType extends GenericMediaItemType>({
  message,
  haveOldest,
  media,
  newMedia,
  sortOrder,
}: {
  message: ReadonlyMessageAttributesType;
  haveOldest: boolean;
  media: ReadonlyArray<ItemType>;
  newMedia: ReadonlyArray<ItemType>;
  sortOrder: MediaSortOrderType;
}): [ReadonlyArray<ItemType>, boolean] {
  const mediaWithout = media.filter(item => item.message.id !== message.id);
  const difference = media.length - mediaWithout.length;

  if (message.deletedForEveryone || message.isErased) {
    // If message is erased and there was media from this message - update state
    if (difference > 0) {
      return [mediaWithout, haveOldest];
    }
    return [media, haveOldest];
  }

  const oldest = media[0];

  let inMediaTimeRange: boolean;

  if (oldest == null) {
    inMediaTimeRange = true;
  } else if (sortOrder === 'date') {
    inMediaTimeRange =
      message.received_at >= oldest.message.receivedAt &&
      message.sent_at >= oldest.message.sentAt;
  } else if (sortOrder === 'size') {
    const messageLatest = _sortItems(newMedia, sortOrder).at(-1);
    inMediaTimeRange =
      messageLatest == null ||
      (getMediaItemSize(messageLatest) >= getMediaItemSize(oldest) &&
        message.received_at >= oldest.message.receivedAt &&
        message.sent_at >= oldest.message.sentAt);
  } else {
    throw missingCaseError(sortOrder);
  }

  // If message is updated out of current range - it means that the oldest
  // message in the view might no longer be the oldest in the database.
  if (!inMediaTimeRange) {
    return [media, false];
  }

  // If the message is in the view and attachments might have changed - update
  if (difference > 0 || newMedia.length > 0) {
    return [_sortItems(mediaWithout.concat(newMedia), sortOrder), haveOldest];
  }

  return [media, haveOldest];
}

function _sortItems<
  Item extends ReadonlyDeep<{
    attachment?: AttachmentForUIType;
    message: MediaItemMessageType;
  }>,
>(
  items: ReadonlyArray<Item>,
  sortOrder: MediaSortOrderType
): ReadonlyArray<Item> {
  if (sortOrder === 'date') {
    return orderBy(items, [
      'message.receivedAt',
      'message.sentAt',
      'message.index',
    ]);
  }
  if (sortOrder === 'size') {
    return orderBy(items, [
      'attachment.size',
      'message.receivedAt',
      'message.sentAt',
      'message.index',
    ]);
  }
  throw missingCaseError(sortOrder);
}

function _cleanMessage(
  message: ReadonlyMessageAttributesType
): MediaItemMessageType {
  return {
    id: message.id,
    type: message.type,
    source: message.source,
    sourceServiceId: message.sourceServiceId,
    conversationId: message.conversationId,
    receivedAt: message.received_at,
    receivedAtMs: message.received_at_ms,
    sentAt: message.sent_at,
    isErased: !!message.isErased,
    errors: message.errors,
    readStatus: message.readStatus,
    sendStateByConversationId: message.sendStateByConversationId,
  };
}

function _cleanAttachment(
  type: 'media' | 'audio' | 'documents',
  { message, index, attachment }: MediaItemDBType
): MediaItemType {
  return {
    type: type === 'documents' ? 'document' : type,
    index,
    attachment: getPropsForAttachment(attachment, 'attachment', message),
    message,
  };
}

function _cleanAttachments(
  type: 'media' | 'audio' | 'documents',
  rawMedia: ReadonlyArray<MediaItemDBType>
): ReadonlyArray<MediaItemType> {
  return rawMedia.map(media => _cleanAttachment(type, media));
}

function _cleanContact(raw: ContactMediaItemDBType): ContactMediaItemType {
  const { message, contact } = raw;
  return {
    type: 'contact',
    contact: {
      ...contact,
      avatar:
        contact.avatar?.avatar == null
          ? undefined
          : {
              ...contact.avatar,
              avatar: getPropsForAttachment(
                contact.avatar.avatar,
                'contact',
                message
              ),
            },
    },
    message,
  };
}

function _cleanDocuments(
  rawDocuments: ReadonlyArray<MediaItemDBType | ContactMediaItemDBType>
): ReadonlyArray<MediaItemType | ContactMediaItemType> {
  return rawDocuments.map(rawDocument => {
    if (rawDocument.type === 'mediaItem') {
      return _cleanAttachment('documents', rawDocument);
    }

    strictAssert(
      rawDocument.type === 'contact',
      `Unexpected documen type ${rawDocument.type}`
    );
    return _cleanContact(rawDocument);
  });
}

function _cleanLinkPreviews(
  rawPreviews: ReadonlyArray<NonAttachmentMediaItemDBType>
): ReadonlyArray<LinkPreviewMediaItemType> {
  return rawPreviews.map(raw => {
    strictAssert(raw.type === 'link', 'Expected link preview');

    const { message, preview } = raw;
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

function sortOrderToOrder(sortOrder: MediaSortOrderType): 'older' | 'bigger' {
  switch (sortOrder) {
    case 'date':
      return 'older';
    case 'size':
      return 'bigger';
    default:
      throw missingCaseError(sortOrder);
  }
}

function initialLoad(
  conversationId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  InitialLoadActionType | SetLoadingActionType
> {
  return async (dispatch, getState) => {
    dispatch({
      type: SET_LOADING,
      payload: { loading: true },
    });

    const {
      mediaGallery: { sortOrder },
    } = getState();
    const order = sortOrderToOrder(sortOrder);

    const [rawMedia, rawAudio, rawDocuments, rawLinkPreviews] =
      await Promise.all([
        DataReader.getSortedMedia({
          conversationId,
          limit: FETCH_CHUNK_COUNT,
          type: 'media',
          order,
        }),
        DataReader.getSortedMedia({
          conversationId,
          limit: FETCH_CHUNK_COUNT,
          type: 'audio',
          order,
        }),
        // Note: `getSortedDocuments` mixes in contacts
        DataReader.getSortedDocuments({
          conversationId,
          limit: FETCH_CHUNK_COUNT,
          order,
        }),
        DataReader.getSortedNonAttachmentMedia({
          conversationId,
          limit: FETCH_CHUNK_COUNT,
          type: 'links',
          order,
        }),
      ]);

    const media = _cleanAttachments('media', rawMedia);
    const audio = _cleanAttachments('audio', rawAudio);
    const documents = _cleanDocuments(rawDocuments);
    const links = _cleanLinkPreviews(rawLinkPreviews);

    dispatch({
      type: INITIAL_LOAD,
      payload: {
        conversationId,
        media,
        audio,
        links,
        documents,
      },
    });
  };
}

function loadMore(
  conversationId: string,
  type: MediaTabType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  InitialLoadActionType | LoadMoreActionType | SetLoadingActionType
> {
  return async (dispatch, getState) => {
    const { mediaGallery } = getState();
    const { conversationId: previousConversationId, sortOrder } = mediaGallery;

    if (conversationId !== previousConversationId) {
      log.warn('loadMore: conversationId mismatch; calling initialLoad()');
      initialLoad(conversationId)(dispatch, getState, {});
      return;
    }

    let previousItems: ReadonlyArray<
      MediaItemType | LinkPreviewMediaItemType | ContactMediaItemType
    >;
    if (type === 'media') {
      previousItems = mediaGallery.media;
    } else if (type === 'audio') {
      previousItems = mediaGallery.audio;
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
      size: getMediaItemSize(oldestLoadedItem),
      order: sortOrderToOrder(sortOrder),
    };

    let media: ReadonlyArray<MediaItemType> = [];
    let audio: ReadonlyArray<MediaItemType> = [];
    let documents: ReadonlyArray<MediaItemType | ContactMediaItemType> = [];
    let links: ReadonlyArray<LinkPreviewMediaItemType> = [];
    if (type === 'media' || type === 'audio') {
      strictAssert(oldestLoadedItem.type === type, 'must be a media item');

      const rawMedia = await DataReader.getSortedMedia({
        ...sharedOptions,
        type,
      });

      const result = _cleanAttachments(type, rawMedia);
      if (type === 'media') {
        media = result;
      } else if (type === 'audio') {
        audio = result;
      } else {
        throw missingCaseError(type);
      }
    } else if (type === 'documents') {
      // Note: `getSortedDocuments` mixes in contacts
      const rawDocuments = await DataReader.getSortedDocuments(sharedOptions);

      documents = _cleanDocuments(rawDocuments);
    } else if (type === 'links') {
      const rawPreviews = await DataReader.getSortedNonAttachmentMedia({
        ...sharedOptions,
        type,
      });
      links = _cleanLinkPreviews(rawPreviews);
    } else {
      throw missingCaseError(type);
    }

    dispatch({
      type: LOAD_MORE,
      payload: {
        conversationId,
        media,
        audio,
        documents,
        links,
      },
    });
  };
}

function setTab(tab: MediaGalleryStateType['tab']): SetTabActionType {
  return {
    type: SET_TAB,
    payload: {
      tab,
    },
  };
}

function setSortOrder(
  sortOrder: MediaGalleryStateType['sortOrder']
): SetSortOrderActionType {
  return {
    type: SET_SORT_ORDER,
    payload: {
      sortOrder,
    },
  };
}

export const actions = {
  initialLoad,
  loadMore,
  setTab,
  setSortOrder,
};

export const useMediaGalleryActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function getEmptyState(): MediaGalleryStateType {
  return {
    tab: 'media',
    sortOrder: 'date',
    conversationId: undefined,
    haveOldestDocument: false,
    haveOldestMedia: false,
    haveOldestAudio: false,
    haveOldestLink: false,
    loading: true,
    media: [],
    audio: [],
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
      tab: 'media',
      sortOrder: state.sortOrder,
      loading: false,
      conversationId: payload.conversationId,
      haveOldestMedia: payload.media.length === 0,
      haveOldestAudio: payload.audio.length === 0,
      haveOldestLink: payload.links.length === 0,
      haveOldestDocument: payload.documents.length === 0,
      media: _sortItems(payload.media, state.sortOrder),
      audio: _sortItems(payload.audio, state.sortOrder),
      links: _sortItems(payload.links, 'date'),
      documents: _sortItems(payload.documents, state.sortOrder),
    };
  }

  if (action.type === LOAD_MORE) {
    const { conversationId, media, audio, documents, links } = action.payload;
    if (state.conversationId !== conversationId) {
      return state;
    }

    return {
      ...state,
      loading: false,
      haveOldestMedia: media.length === 0,
      haveOldestAudio: audio.length === 0,
      haveOldestDocument: documents.length === 0,
      haveOldestLink: links.length === 0,
      media: _sortItems(media.concat(state.media), state.sortOrder),
      audio: _sortItems(audio.concat(state.audio), state.sortOrder),
      links: _sortItems(links.concat(state.links), 'date'),
      documents: _sortItems(documents.concat(state.documents), state.sortOrder),
    };
  }

  if (action.type === SET_TAB) {
    const { tab } = action.payload;

    return {
      ...state,
      tab,
    };
  }

  if (action.type === SET_SORT_ORDER) {
    const { sortOrder } = action.payload;

    return {
      ...getEmptyState(),
      loading: true,
      tab: state.tab,
      sortOrder,
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

    const messageMediaItems: Array<MediaItemDBType> = (
      message.attachments ?? []
    ).map((attachment, index) => {
      return {
        type: 'mediaItem',
        index,
        attachment,
        message: _cleanMessage(message),
      };
    });

    const newMedia = _cleanAttachments(
      'media',
      messageMediaItems.filter(({ attachment }) => isVisualMedia(attachment))
    );
    const newAudio = _cleanAttachments(
      'audio',
      messageMediaItems.filter(
        ({ attachment }) => isVoiceMessage(attachment) || isAudio([attachment])
      )
    );
    const newLinks = _cleanLinkPreviews(
      message.preview != null && message.preview.length > 0
        ? [
            {
              type: 'link',
              preview: message.preview[0],
              message: _cleanMessage(message),
            },
          ]
        : []
    );
    let newDocuments: ReadonlyArray<MediaItemType | ContactMediaItemType> =
      _cleanAttachments(
        'documents',
        messageMediaItems.filter(({ attachment }) => isFile(attachment))
      );
    if (message.contact != null && message.contact.length > 0) {
      newDocuments = newDocuments.concat(
        _cleanContact({
          type: 'contact',
          contact: message.contact[0],
          message: _cleanMessage(message),
        })
      );
    }

    const { sortOrder } = state;

    const [media, haveOldestMedia] = _updateMedia({
      message,
      haveOldest: state.haveOldestMedia,
      media: state.media,
      newMedia,
      sortOrder,
    });
    const [audio, haveOldestAudio] = _updateMedia({
      message,
      haveOldest: state.haveOldestAudio,
      media: state.audio,
      newMedia: newAudio,
      sortOrder,
    });
    const [documents, haveOldestDocument] = _updateMedia({
      message,
      haveOldest: state.haveOldestDocument,
      media: state.documents,
      newMedia: newDocuments,
      sortOrder,
    });
    const [links, haveOldestLink] = _updateMedia({
      message,
      haveOldest: state.haveOldestLink,
      media: state.links,
      newMedia: newLinks,
      sortOrder: 'date',
    });

    if (
      state.haveOldestMedia !== haveOldestMedia ||
      state.haveOldestAudio !== haveOldestAudio ||
      state.haveOldestLink !== haveOldestLink ||
      state.haveOldestDocument !== haveOldestDocument ||
      state.media !== media ||
      state.audio !== audio ||
      state.links !== links ||
      state.documents !== documents
    ) {
      return {
        ...state,
        haveOldestMedia,
        haveOldestAudio,
        haveOldestLink,
        haveOldestDocument,
        media,
        audio,
        links,
        documents,
      };
    }

    return state;
  }

  if (action.type === MESSAGE_DELETED || action.type === MESSAGE_EXPIRED) {
    return {
      ...state,
      media: state.media.filter(item => item.message.id !== action.payload.id),
      audio: state.audio.filter(item => item.message.id !== action.payload.id),
      links: state.links.filter(item => item.message.id !== action.payload.id),
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
