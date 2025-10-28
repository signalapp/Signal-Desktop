// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Modal } from './Modal.dom.js';
import { Button } from './Button.dom.js';
import { ThemeType } from '../types/Util.std.js';

import type { LocalizerType } from '../types/Util.std.js';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onClose: () => unknown;
  theme: ThemeType;
}>;

export function ProfileMovedModal({
  i18n,
  onClose,
  theme,
}: PropsType): JSX.Element {
  const imagePath =
    theme === ThemeType.dark
      ? 'images/profile-moved-dark.svg'
      : 'images/profile-moved.svg';

  return (
    <Modal
      modalName="ProfileMovedModal"
      moduleClassName="ProfileMovedModal"
      i18n={i18n}
      onClose={onClose}
    >
      <div className="ProfileMovedModal__contents">
        <div className="ProfileMovedModal__main">
          <div className="ProfileMovedModal__image">
            <img src={imagePath} height="150" width="200" alt="" />
          </div>
          <div className="ProfileMovedModal__title">
            {i18n('icu:ProfileMovedModal__title')}
          </div>
          <div className="ProfileMovedModal__description">
            {i18n('icu:ProfileMovedModal__description')}
          </div>
        </div>
        <Button className="ProfileMovedModal__button" onClick={onClose}>
          {i18n('icu:ok')}
        </Button>
      </div>
    </Modal>
  );
}
