// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import type { AttachmentType } from '../../types/Attachment';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { MediaItemType } from '../../types/MediaItem';
import type { MessageExpiredActionType } from './conversations';
import type { ShowStickerPackPreviewActionType } from './globalModals';
import type { ShowToastActionType } from './toast';
import type { StateType as RootStateType } from '../reducer';

import * as log from '../../logging/log';
import { getMessageById } from '../../messages/getMessageById';
import { isGIF } from '../../types/Attachment';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';
import { isTapToView } from '../selectors/message';
import { SHOW_TOAST } from './toast';
import { ToastType } from '../../types/Toast';
import { MESSAGE_EXPIRED, saveAttachmentFromMessage } from './conversations';
import { showStickerPackPreview } from './globalModals';
import { useBoundActions } from '../../hooks/useBoundActions';

export type LightboxStateType =
  | {
      isShowingLightbox: false;
    }
  | {
      isShowingLightbox: true;
      isViewOnce: boolean;
      media: Array<MediaItemType>;
      selectedAttachmentPath: string | undefined;
    };

const CLOSE_LIGHTBOX = 'lightbox/CLOSE';
const SHOW_LIGHTBOX = 'lightbox/SHOW';

type CloseLightboxActionType = {
  type: typeof CLOSE_LIGHTBOX;
};

type ShowLightboxActionType = {
  type: typeof SHOW_LIGHTBOX;
  payload: {
    isViewOnce: boolean;
    media: Array<MediaItemType>;
    selectedAttachmentPath: string | undefined;
  };
};

type LightboxActionType =
  | CloseLightboxActionType
  | MessageExpiredActionType
  | ShowLightboxActionType;

function closeLightbox(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CloseLightboxActionType
> {
  return (dispatch, getState) => {
    const { lightbox } = getState();

    if (!lightbox.isShowingLightbox) {
      return;
    }

    const { isViewOnce, media } = lightbox;

    if (isViewOnce) {
      media.forEach(item => {
        if (!item.attachment.path) {
          return;
        }
        void window.Signal.Migrations.deleteTempFile(item.attachment.path);
      });
    }

    dispatch({
      type: CLOSE_LIGHTBOX,
    });
  };
}

function showLightboxWithMedia(
  selectedAttachmentPath: string | undefined,
  media: Array<MediaItemType>
): ShowLightboxActionType {
  return {
    type: SHOW_LIGHTBOX,
    payload: {
      isViewOnce: false,
      media,
      selectedAttachmentPath,
    },
  };
}

function showLightboxForViewOnceMedia(
  messageId: string
): ThunkAction<void, RootStateType, unknown, ShowLightboxActionType> {
  return async dispatch => {
    log.info('showLightboxForViewOnceMedia: attempting to display message');

    const message = await getMessageById(messageId);
    if (!message) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${messageId} missing!`
      );
    }

    if (!isTapToView(message.attributes)) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${message.idForLogging()} is not a tap to view message`
      );
    }

    if (message.isErased()) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${message.idForLogging()} is already erased`
      );
    }

    const firstAttachment = (message.get('attachments') || [])[0];
    if (!firstAttachment || !firstAttachment.path) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${message.idForLogging()} had no first attachment with path`
      );
    }

    const {
      copyIntoTempDirectory,
      getAbsoluteAttachmentPath,
      getAbsoluteTempPath,
    } = window.Signal.Migrations;

    const absolutePath = getAbsoluteAttachmentPath(firstAttachment.path);
    const { path: tempPath } = await copyIntoTempDirectory(absolutePath);
    const tempAttachment = {
      ...firstAttachment,
      path: tempPath,
    };

    await message.markViewOnceMessageViewed();

    const { path, contentType } = tempAttachment;

    const media = [
      {
        attachment: tempAttachment,
        objectURL: getAbsoluteTempPath(path),
        contentType,
        index: 0,
        // TODO maybe we need to listen for message change?
        message: {
          attachments: message.get('attachments') || [],
          id: message.get('id'),
          conversationId: message.get('conversationId'),
          received_at: message.get('received_at'),
          received_at_ms: Number(message.get('received_at_ms')),
          sent_at: message.get('sent_at'),
        },
      },
    ];

    dispatch({
      type: SHOW_LIGHTBOX,
      payload: {
        isViewOnce: true,
        media,
        selectedAttachmentPath: undefined,
      },
    });
  };
}

function showLightbox(opts: {
  attachment: AttachmentType;
  messageId: string;
}): ThunkAction<
  void,
  RootStateType,
  unknown,
  | ShowLightboxActionType
  | ShowStickerPackPreviewActionType
  | ShowToastActionType
> {
  return async (dispatch, getState) => {
    const { attachment, messageId } = opts;

    const message = await getMessageById(messageId);
    if (!message) {
      throw new Error(`showLightbox: Message ${messageId} missing!`);
    }
    const sticker = message.get('sticker');
    if (sticker) {
      const { packId, packKey } = sticker;
      dispatch(showStickerPackPreview(packId, packKey));
      return;
    }

    const { contentType } = attachment;

    if (
      !isImageTypeSupported(contentType) &&
      !isVideoTypeSupported(contentType)
    ) {
      saveAttachmentFromMessage(messageId, attachment)(
        dispatch,
        getState,
        null
      );
      return;
    }

    const attachments: Array<AttachmentType> = message.get('attachments') || [];

    const loop = isGIF(attachments);

    const { getAbsoluteAttachmentPath } = window.Signal.Migrations;

    const media = attachments
      .filter(item => item.thumbnail && !item.pending && !item.error)
      .map((item, index) => ({
        objectURL: getAbsoluteAttachmentPath(item.path ?? ''),
        path: item.path,
        contentType: item.contentType,
        loop,
        index,
        message: {
          attachments: message.get('attachments') || [],
          id: message.get('id'),
          conversationId:
            window.ConversationController.lookupOrCreate({
              uuid: message.get('sourceUuid'),
              e164: message.get('source'),
              reason: 'conversation_view.showLightBox',
            })?.id || message.get('conversationId'),
          received_at: message.get('received_at'),
          received_at_ms: Number(message.get('received_at_ms')),
          sent_at: message.get('sent_at'),
        },
        attachment: item,
        thumbnailObjectUrl:
          item.thumbnail?.objectUrl ||
          getAbsoluteAttachmentPath(item.thumbnail?.path ?? ''),
      }));

    if (!media.length) {
      log.error(
        'showLightbox: unable to load attachment',
        attachments.map(x => ({
          contentType: x.contentType,
          error: x.error,
          flags: x.flags,
          path: x.path,
          size: x.size,
        }))
      );

      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.UnableToLoadAttachment,
        },
      });
      return;
    }

    dispatch({
      type: SHOW_LIGHTBOX,
      payload: {
        isViewOnce: false,
        media,
        selectedAttachmentPath: attachment.path,
      },
    });
  };
}

export const actions = {
  closeLightbox,
  showLightbox,
  showLightboxForViewOnceMedia,
  showLightboxWithMedia,
};

export const useLightboxActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function getEmptyState(): LightboxStateType {
  return {
    isShowingLightbox: false,
  };
}

export function reducer(
  state: Readonly<LightboxStateType> = getEmptyState(),
  action: Readonly<LightboxActionType>
): LightboxStateType {
  if (action.type === CLOSE_LIGHTBOX) {
    return getEmptyState();
  }

  if (action.type === SHOW_LIGHTBOX) {
    return {
      ...action.payload,
      isShowingLightbox: true,
    };
  }

  if (action.type === MESSAGE_EXPIRED) {
    if (!state.isShowingLightbox) {
      return state;
    }

    if (!state.isViewOnce) {
      return state;
    }

    const hasExpiredMedia = state.media.some(
      item => item.message.id === action.payload.id
    );

    if (!hasExpiredMedia) {
      return state;
    }

    return getEmptyState();
  }

  return state;
}
