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
import { Modal } from '../../Modal';
import { AvatarInput, AvatarInputVariant } from '../../AvatarInput';
import { Button, ButtonVariant } from '../../Button';
import { Spinner } from '../../Spinner';
import { GroupDescriptionInput } from '../../GroupDescriptionInput';
import { GroupTitleInput } from '../../GroupTitleInput';
import * as log from '../../../logging/log';
import { canvasToArrayBuffer } from '../../../util/canvasToArrayBuffer';
import { RequestState } from './util';

const TEMPORARY_AVATAR_VALUE = new ArrayBuffer(0);

type PropsType = {
  avatarPath?: string;
  groupDescription?: string;
  i18n: LocalizerType;
  initiallyFocusDescription: boolean;
  makeRequest: (
    _: Readonly<{
      avatar?: undefined | ArrayBuffer;
      description?: string;
      title?: undefined | string;
    }>
  ) => void;
  onClose: () => void;
  requestState: RequestState;
  title: string;
};

export const EditConversationAttributesModal: FunctionComponent<PropsType> = ({
  avatarPath: externalAvatarPath,
  groupDescription: externalGroupDescription = '',
  i18n,
  initiallyFocusDescription,
  makeRequest,
  onClose,
  requestState,
  title: externalTitle,
}) => {
  const focusDescriptionRef = useRef<undefined | boolean>(
    initiallyFocusDescription
  );
  const focusDescription = focusDescriptionRef.current;

  const startingTitleRef = useRef<string>(externalTitle);
  const startingAvatarPathRef = useRef<undefined | string>(externalAvatarPath);

  const [avatar, setAvatar] = useState<undefined | ArrayBuffer>(
    externalAvatarPath ? TEMPORARY_AVATAR_VALUE : undefined
  );
  const [rawTitle, setRawTitle] = useState(externalTitle);
  const [rawGroupDescription, setRawGroupDescription] = useState(
    externalGroupDescription
  );
  const [hasAvatarChanged, setHasAvatarChanged] = useState(false);

  const trimmedTitle = rawTitle.trim();
  const trimmedDescription = rawGroupDescription.trim();

  const focusRef = (el: null | HTMLElement) => {
    if (el) {
      el.focus();
      focusDescriptionRef.current = undefined;
    }
  };

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
  const hasGroupDescriptionChanged =
    externalGroupDescription.trim() !== trimmedDescription;

  const isRequestActive = requestState === RequestState.Active;

  const canSubmit =
    !isRequestActive &&
    (hasChangedExternally ||
      hasTitleChanged ||
      hasAvatarChanged ||
      hasGroupDescriptionChanged) &&
    trimmedTitle.length > 0;

  const onSubmit: FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();

    const request: {
      avatar?: undefined | ArrayBuffer;
      description?: string;
      title?: string;
    } = {};
    if (hasAvatarChanged) {
      request.avatar = avatar;
    }
    if (hasTitleChanged) {
      request.title = trimmedTitle;
    }
    if (hasGroupDescriptionChanged) {
      request.description = trimmedDescription;
    }
    makeRequest(request);
  };

  return (
    <Modal
      hasXButton
      i18n={i18n}
      onClose={onClose}
      title={i18n('updateGroupAttributes__title')}
    >
      <form
        onSubmit={onSubmit}
        className="module-EditConversationAttributesModal"
      >
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
          ref={focusDescription === false ? focusRef : undefined}
          value={rawTitle}
        />

        <GroupDescriptionInput
          disabled={isRequestActive}
          i18n={i18n}
          onChangeValue={setRawGroupDescription}
          ref={focusDescription === true ? focusRef : undefined}
          value={rawGroupDescription}
        />

        <div className="module-EditConversationAttributesModal__description-warning">
          {i18n('EditConversationAttributesModal__description-warning')}
        </div>

        {requestState === RequestState.InactiveWithError && (
          <div className="module-EditConversationAttributesModal__error-message">
            {i18n('updateGroupAttributes__error-message')}
          </div>
        )}

        <Modal.ButtonFooter>
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
        </Modal.ButtonFooter>
      </form>
    </Modal>
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
