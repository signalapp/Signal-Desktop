// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  FormEventHandler,
  FunctionComponent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { noop } from 'lodash';

import { LocalizerType } from '../../../types/Util';
import { ModalHost } from '../../ModalHost';
import { AvatarInput, AvatarInputVariant } from '../../AvatarInput';
import { Button, ButtonVariant } from '../../Button';
import { Spinner } from '../../Spinner';
import { GroupTitleInput } from '../../GroupTitleInput';
import * as log from '../../../logging/log';
import { canvasToArrayBuffer } from '../../../util/canvasToArrayBuffer';
import { RequestState } from './util';

const TEMPORARY_AVATAR_VALUE = new ArrayBuffer(0);

type PropsType = {
  avatarPath?: string;
  i18n: LocalizerType;
  makeRequest: (
    _: Readonly<{
      avatar?: undefined | ArrayBuffer;
      title?: undefined | string;
    }>
  ) => void;
  onClose: () => void;
  requestState: RequestState;
  title: string;
};

export const EditConversationAttributesModal: FunctionComponent<PropsType> = ({
  avatarPath: externalAvatarPath,
  i18n,
  makeRequest,
  onClose,
  requestState,
  title: externalTitle,
}) => {
  const startingTitleRef = useRef<string>(externalTitle);
  const startingAvatarPathRef = useRef<undefined | string>(externalAvatarPath);

  const [avatar, setAvatar] = useState<undefined | ArrayBuffer>(
    externalAvatarPath ? TEMPORARY_AVATAR_VALUE : undefined
  );
  const [rawTitle, setRawTitle] = useState(externalTitle);
  const [hasAvatarChanged, setHasAvatarChanged] = useState(false);

  const trimmedTitle = rawTitle.trim();

  useEffect(() => {
    const startingAvatarPath = startingAvatarPathRef.current;
    if (!startingAvatarPath) {
      return noop;
    }

    let shouldCancel = false;

    (async () => {
      try {
        const buffer = await imagePathToArrayBuffer(startingAvatarPath);
        if (shouldCancel) {
          return;
        }
        setAvatar(buffer);
      } catch (err) {
        log.warn(
          `Failed to convert image URL to array buffer. Error message: ${
            err && err.message
          }`
        );
      }
    })();

    return () => {
      shouldCancel = true;
    };
  }, []);

  const hasChangedExternally =
    startingAvatarPathRef.current !== externalAvatarPath ||
    startingTitleRef.current !== externalTitle;
  const hasTitleChanged = trimmedTitle !== externalTitle.trim();

  const isRequestActive = requestState === RequestState.Active;

  const canSubmit =
    !isRequestActive &&
    (hasChangedExternally || hasTitleChanged || hasAvatarChanged) &&
    trimmedTitle.length > 0;

  const onSubmit: FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();

    const request: {
      avatar?: undefined | ArrayBuffer;
      title?: string;
    } = {};
    if (hasAvatarChanged) {
      request.avatar = avatar;
    }
    if (hasTitleChanged) {
      request.title = trimmedTitle;
    }
    makeRequest(request);
  };

  return (
    <ModalHost onClose={onClose}>
      <form
        onSubmit={onSubmit}
        className="module-EditConversationAttributesModal"
      >
        <button
          aria-label={i18n('close')}
          className="module-EditConversationAttributesModal__close-button"
          disabled={isRequestActive}
          type="button"
          onClick={() => {
            onClose();
          }}
        />

        <h1 className="module-EditConversationAttributesModal__header">
          {i18n('updateGroupAttributes__title')}
        </h1>

        <AvatarInput
          contextMenuId="edit conversation attributes avatar input"
          disabled={isRequestActive}
          i18n={i18n}
          onChange={newAvatar => {
            setAvatar(newAvatar);
            setHasAvatarChanged(true);
          }}
          value={avatar}
          variant={AvatarInputVariant.Dark}
        />

        <GroupTitleInput
          disabled={isRequestActive}
          i18n={i18n}
          onChangeValue={setRawTitle}
          value={rawTitle}
        />

        {requestState === RequestState.InactiveWithError && (
          <div className="module-EditConversationAttributesModal__error-message">
            {i18n('updateGroupAttributes__error-message')}
          </div>
        )}

        <div className="module-EditConversationAttributesModal__button-container">
          <Button
            disabled={isRequestActive}
            onClick={onClose}
            variant={ButtonVariant.Secondary}
          >
            {i18n('cancel')}
          </Button>

          <Button
            type="submit"
            variant={ButtonVariant.Primary}
            disabled={!canSubmit}
          >
            {isRequestActive ? (
              <Spinner size="20px" svgSize="small" direction="on-avatar" />
            ) : (
              i18n('save')
            )}
          </Button>
        </div>
      </form>
    </ModalHost>
  );
};

async function imagePathToArrayBuffer(src: string): Promise<ArrayBuffer> {
  const image = new Image();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(
      'imagePathToArrayBuffer: could not get canvas rendering context'
    );
  }

  image.src = src;
  await image.decode();

  canvas.width = image.width;
  canvas.height = image.height;

  context.drawImage(image, 0, 0);

  const result = await canvasToArrayBuffer(canvas);
  return result;
}
