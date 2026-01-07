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
  MediaItemMessageType,
  MediaItemType,
  LinkPreviewMediaItemType,
  ContactMediaItemType,
} from '../../types/MediaItem.std.js';
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

type MediaGalleryActionType = ReadonlyDeep<
  | ConversationUnloadedActionType
  | InitialLoadActionType
  | LoadMoreActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessageExpiredActionType
  | SetLoadingActionType
  | SetTabActionType
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

    const { message, contact } = rawDocument;
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

    const [rawMedia, rawAudio, rawDocuments, rawLinkPreviews] =
      await Promise.all([
        DataReader.getSortedMedia({
          conversationId,
          limit: FETCH_CHUNK_COUNT,
          type: 'media',
          order: 'older',
        }),
        DataReader.getSortedMedia({
          conversationId,
          limit: FETCH_CHUNK_COUNT,
          type: 'audio',
          order: 'older',
        }),
        // Note: `getOlderDocuments` mixes in contacts
        DataReader.getOlderDocuments({
          conversationId,
          limit: FETCH_CHUNK_COUNT,
        }),
        DataReader.getOlderNonAttachmentMedia({
          conversationId,
          limit: FETCH_CHUNK_COUNT,
          type: 'links',
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
    const { conversationId: previousConversationId } = mediaGallery;

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
    };

    let media: ReadonlyArray<MediaItemType> = [];
    let audio: ReadonlyArray<MediaItemType> = [];
    let documents: ReadonlyArray<MediaItemType | ContactMediaItemType> = [];
    let links: ReadonlyArray<LinkPreviewMediaItemType> = [];
    if (type === 'media' || type === 'audio') {
      const rawMedia = await DataReader.getSortedMedia({
        ...sharedOptions,
        order: 'older',
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
      // Note: `getOlderDocuments` mixes in contacts
      const rawDocuments = await DataReader.getOlderDocuments(sharedOptions);

      documents = _cleanDocuments(rawDocuments);
    } else if (type === 'links') {
      const rawPreviews = await DataReader.getOlderNonAttachmentMedia({
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

export const actions = {
  initialLoad,
  loadMore,
  setTab,
};

export const useMediaGalleryActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function getEmptyState(): MediaGalleryStateType {
  return {
    tab: 'media',
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
      loading: false,
      conversationId: payload.conversationId,
      haveOldestMedia: payload.media.length === 0,
      haveOldestAudio: payload.audio.length === 0,
      haveOldestLink: payload.links.length === 0,
      haveOldestDocument: payload.documents.length === 0,
      media: _sortItems(payload.media),
      audio: _sortItems(payload.audio),
      links: _sortItems(payload.links),
      documents: _sortItems(payload.documents),
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
      media: _sortItems(media.concat(state.media)),
      audio: _sortItems(audio.concat(state.audio)),
      links: _sortItems(links.concat(state.links)),
      documents: _sortItems(documents.concat(state.documents)),
    };
  }

  if (action.type === SET_TAB) {
    const { tab } = action.payload;

    return {
      ...state,
      tab,
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
    const audioWithout = state.audio.filter(
      item => item.message.id !== message.id
    );
    const documentsWithout = state.documents.filter(
      item => item.message.id !== message.id
    );
    const linksWithout = state.links.filter(
      item => item.message.id !== message.id
    );
    const mediaDifference = state.media.length - mediaWithout.length;
    const audioDifference = state.audio.length - audioWithout.length;
    const documentDifference = state.documents.length - documentsWithout.length;
    const linkDifference = state.links.length - linksWithout.length;

    if (message.deletedForEveryone || message.isErased) {
      if (
        mediaDifference > 0 ||
        audioDifference > 0 ||
        documentDifference > 0 ||
        linkDifference > 0
      ) {
        return {
          ...state,
          media: mediaWithout,
          audio: audioWithout,
          documents: documentsWithout,
          links: linksWithout,
        };
      }
      return state;
    }

    const oldestLoadedMedia = state.media[0];
    const oldestLoadedAudio = state.audio[0];
    const oldestLoadedDocument = state.documents[0];
    const oldestLoadedLink = state.links[0];

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
    const newDocuments = _cleanAttachments(
      'documents',
      messageMediaItems.filter(({ attachment }) => isFile(attachment))
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
    const newContacts = _cleanDocuments(
      message.contact != null && message.contact.length > 0
        ? [
            {
              type: 'contact',
              contact: message.contact[0],
              message: _cleanMessage(message),
            },
          ]
        : []
    );

    let {
      media,
      audio,
      links,
      documents,
      haveOldestMedia,
      haveOldestAudio,
      haveOldestLink,
      haveOldestDocument,
    } = state;

    const inMediaTimeRange =
      !oldestLoadedMedia ||
      (message.received_at >= oldestLoadedMedia.message.receivedAt &&
        message.sent_at >= oldestLoadedMedia.message.sentAt);
    if ((mediaDifference > 0 || newMedia.length > 0) && inMediaTimeRange) {
      media = _sortItems(mediaWithout.concat(newMedia));
    } else if (!inMediaTimeRange) {
      haveOldestMedia = false;
    }

    const inAudioTimeRange =
      !oldestLoadedAudio ||
      (message.received_at >= oldestLoadedAudio.message.receivedAt &&
        message.sent_at >= oldestLoadedAudio.message.sentAt);
    if ((audioDifference > 0 || newAudio.length > 0) && inAudioTimeRange) {
      audio = _sortItems(audioWithout.concat(newAudio));
    } else if (!inAudioTimeRange) {
      haveOldestAudio = false;
    }

    const inDocumentTimeRange =
      !oldestLoadedDocument ||
      (message.received_at >= oldestLoadedDocument.message.receivedAt &&
        message.sent_at >= oldestLoadedDocument.message.sentAt);
    if (
      (documentDifference > 0 ||
        newDocuments.length > 0 ||
        newContacts.length > 0) &&
      inDocumentTimeRange
    ) {
      documents = _sortItems(
        documentsWithout.concat(newDocuments, newContacts)
      );
    } else if (!inDocumentTimeRange) {
      haveOldestDocument = false;
    }

    const inLinkTimeRange =
      !oldestLoadedLink ||
      (message.received_at >= oldestLoadedLink.message.receivedAt &&
        message.sent_at >= oldestLoadedLink.message.sentAt);
    if ((linkDifference > 0 || newLinks.length > 0) && inLinkTimeRange) {
      links = _sortItems(linksWithout.concat(newLinks));
    } else if (!inLinkTimeRange) {
      haveOldestLink = false;
    }

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
