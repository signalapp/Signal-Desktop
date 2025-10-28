// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Modal } from '../Modal.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';

export type PropsType = Readonly<{
  conversationType: 'group' | 'direct';
  i18n: LocalizerType;
  onClose: () => void;
}>;

const DESCRIPTION_KEYS = {
  direct: 'icu:ProfileNameWarningModal__description--direct',
  group: 'icu:ProfileNameWarningModal__description--group',
} as const;

const LIST_ITEM_KEYS = {
  item1: {
    direct: 'icu:ProfileNameWarningModal__list--item1--direct',
    group: 'icu:ProfileNameWarningModal__list--item1--group',
  },
  item2: {
    direct: 'icu:ProfileNameWarningModal__list--item2--direct',
    group: 'icu:ProfileNameWarningModal__list--item2--group',
  },
  item3: {
    direct: 'icu:ProfileNameWarningModal__list--item3--direct',
    group: 'icu:ProfileNameWarningModal__list--item3--group',
  },
} as const;

export function ProfileNameWarningModal({
  conversationType,
  i18n,
  onClose,
}: PropsType): JSX.Element {
  return (
    <Modal
      modalName="ProfileNameWarningModal"
      moduleClassName="ProfileNameWarningModal"
      hasXButton
      i18n={i18n}
      onClose={onClose}
    >
      <i className="ProfileNameWarningModal__header-icon" />
      <div className="ProfileNameWarningModal__description">
        {i18n(DESCRIPTION_KEYS[conversationType])}
      </div>
      <ul className="ProfileNameWarningModal__list">
        <li className="ProfileNameWarningModal__list-item">
          <span className="ProfileNameWarningModal__list-item-text">
            {i18n(LIST_ITEM_KEYS.item1[conversationType])}
          </span>
        </li>
        <li className="ProfileNameWarningModal__list-item">
          <span className="ProfileNameWarningModal__list-item-text">
            {i18n(LIST_ITEM_KEYS.item2[conversationType])}
          </span>
        </li>
        <li className="ProfileNameWarningModal__list-item">
          <span className="ProfileNameWarningModal__list-item-text">
            {i18n(LIST_ITEM_KEYS.item3[conversationType])}
          </span>
        </li>
      </ul>
    </Modal>
  );
}
