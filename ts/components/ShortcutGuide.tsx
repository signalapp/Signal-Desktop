// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { useRestoreFocus } from '../util/hooks';
import { LocalizerType } from '../types/Util';

export type Props = {
  hasInstalledStickers: boolean;
  platform: string;
  readonly close: () => unknown;
  readonly i18n: LocalizerType;
};

type KeyType =
  | 'commandOrCtrl'
  | 'optionOrAlt'
  | 'shift'
  | 'enter'
  | 'tab'
  | 'ctrl'
  | '↑'
  | '↓'
  | ','
  | '.'
  | 'A'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'J'
  | 'L'
  | 'M'
  | 'N'
  | 'P'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'X'
  | '1 to 9';
type ShortcutType = {
  description: string;
  keys: Array<Array<KeyType>>;
};

const NAVIGATION_SHORTCUTS: Array<ShortcutType> = [
  {
    description: 'Keyboard--navigate-by-section',
    keys: [['commandOrCtrl', 'T']],
  },
  {
    description: 'Keyboard--previous-conversation',
    keys: [
      ['optionOrAlt', '↑'],
      ['ctrl', 'shift', 'tab'],
    ],
  },
  {
    description: 'Keyboard--next-conversation',
    keys: [
      ['optionOrAlt', '↓'],
      ['ctrl', 'tab'],
    ],
  },
  {
    description: 'Keyboard--previous-unread-conversation',
    keys: [['optionOrAlt', 'shift', '↑']],
  },
  {
    description: 'Keyboard--next-unread-conversation',
    keys: [['optionOrAlt', 'shift', '↓']],
  },
  {
    description: 'Keyboard--conversation-by-index',
    keys: [['commandOrCtrl', '1 to 9']],
  },
  {
    description: 'Keyboard--preferences',
    keys: [['commandOrCtrl', ',']],
  },
  {
    description: 'Keyboard--open-conversation-menu',
    keys: [['commandOrCtrl', 'shift', 'L']],
  },
  {
    description: 'Keyboard--new-conversation',
    keys: [['commandOrCtrl', 'N']],
  },
  {
    description: 'Keyboard--search',
    keys: [['commandOrCtrl', 'F']],
  },
  {
    description: 'Keyboard--search-in-conversation',
    keys: [['commandOrCtrl', 'shift', 'F']],
  },
  {
    description: 'Keyboard--focus-composer',
    keys: [['commandOrCtrl', 'shift', 'T']],
  },
  {
    description: 'Keyboard--open-all-media-view',
    keys: [['commandOrCtrl', 'shift', 'M']],
  },
  {
    description: 'Keyboard--open-emoji-chooser',
    keys: [['commandOrCtrl', 'shift', 'J']],
  },
  {
    description: 'Keyboard--open-sticker-chooser',
    keys: [['commandOrCtrl', 'shift', 'S']],
  },
  {
    description: 'Keyboard--begin-recording-voice-note',
    keys: [['commandOrCtrl', 'shift', 'V']],
  },
  {
    description: 'Keyboard--archive-conversation',
    keys: [['commandOrCtrl', 'shift', 'A']],
  },
  {
    description: 'Keyboard--unarchive-conversation',
    keys: [['commandOrCtrl', 'shift', 'U']],
  },
  {
    description: 'Keyboard--scroll-to-top',
    keys: [['commandOrCtrl', '↑']],
  },
  {
    description: 'Keyboard--scroll-to-bottom',
    keys: [['commandOrCtrl', '↓']],
  },
  {
    description: 'Keyboard--close-curent-conversation',
    keys: [['commandOrCtrl', 'shift', 'C']],
  },
];

const MESSAGE_SHORTCUTS: Array<ShortcutType> = [
  {
    description: 'Keyboard--default-message-action',
    keys: [['enter']],
  },
  {
    description: 'Keyboard--view-details-for-selected-message',
    keys: [['commandOrCtrl', 'D']],
  },
  {
    description: 'Keyboard--toggle-reply',
    keys: [['commandOrCtrl', 'shift', 'R']],
  },
  {
    description: 'Keyboard--toggle-reaction-picker',
    keys: [['commandOrCtrl', 'shift', 'E']],
  },
  {
    description: 'Keyboard--save-attachment',
    keys: [['commandOrCtrl', 'S']],
  },
  {
    description: 'Keyboard--delete-message',
    keys: [['commandOrCtrl', 'shift', 'D']],
  },
];

const COMPOSER_SHORTCUTS: Array<ShortcutType> = [
  {
    description: 'Keyboard--add-newline',
    keys: [['shift', 'enter']],
  },
  {
    description: 'Keyboard--expand-composer',
    keys: [['commandOrCtrl', 'shift', 'X']],
  },
  {
    description: 'Keyboard--send-in-expanded-composer',
    keys: [['commandOrCtrl', 'enter']],
  },
  {
    description: 'Keyboard--attach-file',
    keys: [['commandOrCtrl', 'U']],
  },
  {
    description: 'Keyboard--remove-draft-link-preview',
    keys: [['commandOrCtrl', 'P']],
  },
  {
    description: 'Keyboard--remove-draft-attachments',
    keys: [['commandOrCtrl', 'shift', 'P']],
  },
];

const CALLING_SHORTCUTS: Array<ShortcutType> = [
  {
    description: 'Keyboard--toggle-audio',
    keys: [['shift', 'M']],
  },
  {
    description: 'Keyboard--toggle-video',
    keys: [['shift', 'V']],
  },
];

export const ShortcutGuide = (props: Props): JSX.Element => {
  const focusRef = React.useRef<HTMLDivElement>(null);
  const { i18n, close, hasInstalledStickers, platform } = props;
  const isMacOS = platform === 'darwin';

  // Restore focus on teardown
  useRestoreFocus(focusRef);

  return (
    <div className="module-shortcut-guide">
      <div className="module-shortcut-guide__header">
        <div className="module-shortcut-guide__header-text">
          {i18n('Keyboard--header')}
        </div>
        <button
          aria-label={i18n('close-popup')}
          className="module-shortcut-guide__header-close"
          onClick={close}
          title={i18n('close-popup')}
          type="button"
        />
      </div>
      <div
        className="module-shortcut-guide__scroll-container"
        ref={focusRef}
        tabIndex={-1}
      >
        <div className="module-shortcut-guide__section-container">
          <div className="module-shortcut-guide__section">
            <div className="module-shortcut-guide__section-header">
              {i18n('Keyboard--navigation-header')}
            </div>
            <div className="module-shortcut-guide__section-list">
              {NAVIGATION_SHORTCUTS.map((shortcut, index) => {
                if (
                  !hasInstalledStickers &&
                  shortcut.description === 'Keyboard--open-sticker-chooser'
                ) {
                  return null;
                }

                return renderShortcut(shortcut, index, isMacOS, i18n);
              })}
            </div>
          </div>
          <div className="module-shortcut-guide__section">
            <div className="module-shortcut-guide__section-header">
              {i18n('Keyboard--messages-header')}
            </div>
            <div className="module-shortcut-guide__section-list">
              {MESSAGE_SHORTCUTS.map((shortcut, index) =>
                renderShortcut(shortcut, index, isMacOS, i18n)
              )}
            </div>
          </div>
          <div className="module-shortcut-guide__section">
            <div className="module-shortcut-guide__section-header">
              {i18n('Keyboard--composer-header')}
            </div>
            <div className="module-shortcut-guide__section-list">
              {COMPOSER_SHORTCUTS.map((shortcut, index) =>
                renderShortcut(shortcut, index, isMacOS, i18n)
              )}
            </div>
          </div>
          <div className="module-shortcut-guide__section">
            <div className="module-shortcut-guide__section-header">
              {i18n('Keyboard--calling-header')}
            </div>
            <div className="module-shortcut-guide__section-list">
              {CALLING_SHORTCUTS.map((shortcut, index) =>
                renderShortcut(shortcut, index, isMacOS, i18n)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function renderShortcut(
  shortcut: ShortcutType,
  index: number,
  isMacOS: boolean,
  i18n: LocalizerType
) {
  return (
    <div key={index} className="module-shortcut-guide__shortcut">
      <div className="module-shortcut-guide__shortcut__description">
        {i18n(shortcut.description)}
      </div>
      <div className="module-shortcut-guide__shortcut__key-container">
        {shortcut.keys.map(keys => (
          <div
            key={`${shortcut.description}--${keys.map(k => k).join('-')}`}
            className="module-shortcut-guide__shortcut__key-inner-container"
          >
            {keys.map(key => {
              let label: string = key;
              let isSquare = true;

              if (key === 'commandOrCtrl' && isMacOS) {
                label = '⌘';
              }
              if (key === 'commandOrCtrl' && !isMacOS) {
                label = i18n('Keyboard--Key--ctrl');
                isSquare = false;
              }
              if (key === 'optionOrAlt' && isMacOS) {
                label = i18n('Keyboard--Key--option');
                isSquare = false;
              }
              if (key === 'optionOrAlt' && !isMacOS) {
                label = i18n('Keyboard--Key--alt');
                isSquare = false;
              }
              if (key === 'ctrl') {
                label = i18n('Keyboard--Key--ctrl');
                isSquare = false;
              }
              if (key === 'shift') {
                label = i18n('Keyboard--Key--shift');
                isSquare = false;
              }
              if (key === 'enter') {
                label = i18n('Keyboard--Key--enter');
                isSquare = false;
              }
              if (key === 'tab') {
                label = i18n('Keyboard--Key--tab');
                isSquare = false;
              }
              if (key === '1 to 9') {
                label = i18n('Keyboard--Key--one-to-nine-range');
                isSquare = false;
              }

              return (
                <span
                  key={`shortcut__key--${key}`}
                  className={classNames(
                    'module-shortcut-guide__shortcut__key',
                    isSquare
                      ? 'module-shortcut-guide__shortcut__key--square'
                      : null
                  )}
                >
                  {label}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
