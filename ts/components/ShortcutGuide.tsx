// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { useRestoreFocus } from '../hooks/useRestoreFocus';
import type { LocalizerType } from '../types/Util';

export type Props = {
  hasInstalledStickers: boolean;
  platform: string;
  readonly close: () => unknown;
  readonly i18n: LocalizerType;
};

type KeyType =
  | 'commandOrCtrl'
  | 'ctrlOrAlt'
  | 'optionOrAlt'
  | 'shift'
  | 'enter'
  | 'tab'
  | 'ctrl'
  | 'F6'
  | 'F10'
  | 'F12'
  | '↑'
  | '↓'
  | ','
  | '.'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'I'
  | 'J'
  | 'K'
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
  | 'Y'
  | '1 to 9';
type ShortcutType = {
  id: string;
  description: string;
} & (
  | {
      keys: Array<Array<KeyType>>;
    }
  | {
      keysByPlatform: {
        macOS: Array<Array<KeyType>>;
        other: Array<Array<KeyType>>;
      };
    }
);

function getNavigationShortcuts(i18n: LocalizerType): Array<ShortcutType> {
  return [
    {
      id: 'Keyboard--navigate-by-section',
      description: i18n('icu:Keyboard--navigate-by-section'),
      keys: [
        ['commandOrCtrl', 'T'],
        ['commandOrCtrl', 'F6'],
      ],
    },
    {
      id: 'Keyboard--previous-conversation',
      description: i18n('icu:Keyboard--previous-conversation'),
      keys: [
        ['optionOrAlt', '↑'],
        ['ctrl', 'shift', 'tab'],
      ],
    },
    {
      id: 'Keyboard--next-conversation',
      description: i18n('icu:Keyboard--next-conversation'),
      keys: [
        ['optionOrAlt', '↓'],
        ['ctrl', 'tab'],
      ],
    },
    {
      id: 'Keyboard--previous-unread-conversation',
      description: i18n('icu:Keyboard--previous-unread-conversation'),
      keys: [['optionOrAlt', 'shift', '↑']],
    },
    {
      id: 'Keyboard--next-unread-conversation',
      description: i18n('icu:Keyboard--next-unread-conversation'),
      keys: [['optionOrAlt', 'shift', '↓']],
    },
    {
      id: 'Keyboard--conversation-by-index',
      description: i18n('icu:Keyboard--conversation-by-index'),
      keys: [['commandOrCtrl', '1 to 9']],
    },
    {
      id: 'Keyboard--most-recent-message',
      description: i18n('icu:Keyboard--focus-most-recent-message'),
      keys: [['commandOrCtrl', 'J']],
    },
    {
      id: 'Keyboard--preferences',
      description: i18n('icu:Keyboard--preferences'),
      keys: [['commandOrCtrl', ',']],
    },
    {
      id: 'Keyboard--open-conversation-menu',
      description: i18n('icu:Keyboard--open-conversation-menu'),
      keys: [['commandOrCtrl', 'shift', 'L']],
    },
    {
      id: 'Keyboard--new-conversation',
      description: i18n('icu:Keyboard--new-conversation'),
      keys: [['commandOrCtrl', 'N']],
    },
    {
      id: 'Keyboard--search',
      description: i18n('icu:Keyboard--search'),
      keys: [['commandOrCtrl', 'F']],
    },
    {
      id: 'Keyboard--search-in-conversation',
      description: i18n('icu:Keyboard--search-in-conversation'),
      keys: [['commandOrCtrl', 'shift', 'F']],
    },
    {
      id: 'Keyboard--focus-composer',
      description: i18n('icu:Keyboard--focus-composer'),
      keys: [['commandOrCtrl', 'shift', 'T']],
    },
    {
      id: 'Keyboard--open-all-media-view',
      description: i18n('icu:Keyboard--open-all-media-view'),
      keys: [['commandOrCtrl', 'shift', 'M']],
    },
    {
      id: 'Keyboard--open-emoji-chooser',
      description: i18n('icu:Keyboard--open-emoji-chooser'),
      keys: [['commandOrCtrl', 'shift', 'J']],
    },
    {
      id: 'Keyboard--open-sticker-chooser',
      description: i18n('icu:Keyboard--open-sticker-chooser'),
      keys: [['commandOrCtrl', 'shift', 'G']],
    },
    {
      id: 'Keyboard--begin-recording-voice-note',
      description: i18n('icu:Keyboard--begin-recording-voice-note'),
      keys: [['commandOrCtrl', 'shift', 'Y']],
    },
    {
      id: 'Keyboard--archive-conversation',
      description: i18n('icu:Keyboard--archive-conversation'),
      keys: [['commandOrCtrl', 'shift', 'A']],
    },
    {
      id: 'Keyboard--unarchive-conversation',
      description: i18n('icu:Keyboard--unarchive-conversation'),
      keys: [['commandOrCtrl', 'shift', 'U']],
    },
    {
      id: 'Keyboard--scroll-to-top',
      description: i18n('icu:Keyboard--scroll-to-top'),
      keys: [['commandOrCtrl', '↑']],
    },
    {
      id: 'Keyboard--scroll-to-bottom',
      description: i18n('icu:Keyboard--scroll-to-bottom'),
      keys: [['commandOrCtrl', '↓']],
    },
    {
      id: 'Keyboard--close-curent-conversation',
      description: i18n('icu:Keyboard--close-curent-conversation'),
      keys: [['commandOrCtrl', 'shift', 'C']],
    },
  ];
}

function getMessageShortcuts(i18n: LocalizerType): Array<ShortcutType> {
  return [
    {
      id: 'Keyboard--default-message-action',
      description: i18n('icu:Keyboard--default-message-action'),
      keys: [['enter']],
    },
    {
      id: 'Keyboard--view-details-for-selected-message',
      description: i18n('icu:Keyboard--view-details-for-selected-message'),
      keys: [['commandOrCtrl', 'D']],
    },
    {
      id: 'Keyboard--toggle-reply',
      description: i18n('icu:Keyboard--toggle-reply'),
      keys: [['commandOrCtrl', 'shift', 'R']],
    },
    {
      id: 'Keyboard--toggle-reaction-picker',
      description: i18n('icu:Keyboard--toggle-reaction-picker'),
      keys: [['commandOrCtrl', 'shift', 'E']],
    },
    {
      id: 'Keyboard--save-attachment',
      description: i18n('icu:Keyboard--save-attachment'),
      keys: [['commandOrCtrl', 'S']],
    },
    {
      id: 'Keyboard--delete-messages',
      description: i18n('icu:Keyboard--delete-messages'),
      keys: [['commandOrCtrl', 'shift', 'D']],
    },
    {
      id: 'Keyboard--forward-messages',
      description: i18n('icu:Keyboard--forward-messages'),
      keys: [['commandOrCtrl', 'shift', 'S']],
    },
    {
      id: 'Keyboard--open-context-menu',
      description: i18n('icu:Keyboard--open-context-menu'),
      keysByPlatform: {
        macOS: [['commandOrCtrl', 'F12']],
        other: [['shift', 'F10']],
      },
    },
  ];
}

function getComposerShortcuts(i18n: LocalizerType): Array<ShortcutType> {
  const shortcuts: Array<ShortcutType> = [
    {
      id: 'Keyboard--add-newline',
      description: i18n('icu:Keyboard--add-newline'),
      keys: [['shift', 'enter']],
    },
    {
      id: 'Keyboard--expand-composer',
      description: i18n('icu:Keyboard--expand-composer'),
      keys: [['commandOrCtrl', 'shift', 'K']],
    },
    {
      id: 'Keyboard--send-in-expanded-composer',
      description: i18n('icu:Keyboard--send-in-expanded-composer'),
      keys: [['commandOrCtrl', 'enter']],
    },
    {
      id: 'Keyboard--attach-file',
      description: i18n('icu:Keyboard--attach-file'),
      keys: [['commandOrCtrl', 'U']],
    },
    {
      id: 'Keyboard--remove-draft-link-preview',
      description: i18n('icu:Keyboard--remove-draft-link-preview'),
      keys: [['commandOrCtrl', 'P']],
    },
    {
      id: 'Keyboard--remove-draft-attachments',
      description: i18n('icu:Keyboard--remove-draft-attachments'),
      keys: [['commandOrCtrl', 'shift', 'P']],
    },
    {
      id: 'Keyboard--edit-last-message',
      description: i18n('icu:Keyboard--edit-last-message'),
      keys: [['↑']],
    },
    {
      id: 'Keyboard--composer--bold',
      description: i18n('icu:Keyboard--composer--bold'),
      keys: [['commandOrCtrl', 'B']],
    },
    {
      id: 'Keyboard--composer--italic',
      description: i18n('icu:Keyboard--composer--italic'),
      keys: [['commandOrCtrl', 'I']],
    },
    {
      id: 'Keyboard--composer--strikethrough',
      description: i18n('icu:Keyboard--composer--strikethrough'),
      keys: [['commandOrCtrl', 'shift', 'X']],
    },
    {
      id: 'Keyboard--composer--monospace',
      description: i18n('icu:Keyboard--composer--monospace'),
      keys: [['commandOrCtrl', 'E']],
    },
    {
      id: 'Keyboard--composer--spoiler',
      description: i18n('icu:Keyboard--composer--spoiler'),
      keys: [['commandOrCtrl', 'shift', 'B']],
    },
  ];

  return shortcuts;
}

function getCallingShortcuts(i18n: LocalizerType): Array<ShortcutType> {
  return [
    {
      id: 'Keyboard--toggle-audio',
      description: i18n('icu:Keyboard--toggle-audio'),
      keys: [['shift', 'M']],
    },
    {
      id: 'Keyboard--toggle-video',
      description: i18n('icu:Keyboard--toggle-video'),
      keys: [['shift', 'V']],
    },
    {
      id: 'icu:Keyboard--accept-video-call',
      description: i18n('icu:Keyboard--accept-video-call'),
      keys: [['ctrlOrAlt', 'shift', 'V']],
    },
    {
      id: 'icu:Keyboard--accept-call-without-video',
      description: i18n('icu:Keyboard--accept-call-without-video'),
      keys: [['ctrlOrAlt', 'shift', 'A']],
    },
    {
      id: 'Keyboard--decline-call',
      description: i18n('icu:Keyboard--decline-call'),
      keys: [['ctrlOrAlt', 'shift', 'D']],
    },
    {
      id: 'Keyboard--start-audio-call',
      description: i18n('icu:Keyboard--start-audio-call'),
      keys: [['ctrlOrAlt', 'shift', 'C']],
    },
    {
      id: 'Keyboard--start-video-call',
      description: i18n('icu:Keyboard--start-video-call'),
      keys: [['ctrlOrAlt', 'shift', 'Y']],
    },
    {
      id: 'Keyboard--hang-up',
      description: i18n('icu:Keyboard--hang-up'),
      keys: [['ctrlOrAlt', 'shift', 'E']],
    },
  ];
}

export function ShortcutGuide(props: Props): JSX.Element {
  const { i18n, close, hasInstalledStickers, platform } = props;
  const isMacOS = platform === 'darwin';

  // Restore focus on teardown
  const [focusRef] = useRestoreFocus();

  return (
    <div className="module-shortcut-guide">
      <div className="module-shortcut-guide__header">
        <div className="module-shortcut-guide__header-text">
          {i18n('icu:Keyboard--header')}
        </div>
        <button
          aria-label={i18n('icu:close-popup')}
          className="module-shortcut-guide__header-close"
          onClick={close}
          title={i18n('icu:close-popup')}
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
              {i18n('icu:Keyboard--navigation-header')}
            </div>
            <div className="module-shortcut-guide__section-list">
              {getNavigationShortcuts(i18n).map((shortcut, index) => {
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
              {i18n('icu:Keyboard--messages-header')}
            </div>
            <div className="module-shortcut-guide__section-list">
              {getMessageShortcuts(i18n).map((shortcut, index) =>
                renderShortcut(shortcut, index, isMacOS, i18n)
              )}
            </div>
          </div>
          <div className="module-shortcut-guide__section">
            <div className="module-shortcut-guide__section-header">
              {i18n('icu:Keyboard--composer-header')}
            </div>
            <div className="module-shortcut-guide__section-list">
              {getComposerShortcuts(i18n).map((shortcut, index) =>
                renderShortcut(shortcut, index, isMacOS, i18n)
              )}
            </div>
          </div>
          <div className="module-shortcut-guide__section">
            <div className="module-shortcut-guide__section-header">
              {i18n('icu:Keyboard--calling-header')}
            </div>
            <div className="module-shortcut-guide__section-list">
              {getCallingShortcuts(i18n).map((shortcut, index) =>
                renderShortcut(shortcut, index, isMacOS, i18n)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderShortcut(
  shortcut: ShortcutType,
  index: number,
  isMacOS: boolean,
  i18n: LocalizerType
) {
  let keysToRender: Array<Array<KeyType>> = [];

  if ('keys' in shortcut) {
    keysToRender = shortcut.keys;
  } else if ('keysByPlatform' in shortcut) {
    keysToRender = isMacOS
      ? shortcut.keysByPlatform.macOS
      : shortcut.keysByPlatform.other;
  }

  return (
    <div key={index} className="module-shortcut-guide__shortcut">
      <div className="module-shortcut-guide__shortcut__description">
        {shortcut.description}
      </div>
      <div className="module-shortcut-guide__shortcut__key-container">
        {keysToRender.map(keys => (
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
                label = i18n('icu:Keyboard--Key--ctrl');
                isSquare = false;
              }
              if (key === 'ctrlOrAlt' && isMacOS) {
                label = i18n('icu:Keyboard--Key--ctrl');
                isSquare = false;
              }
              if (key === 'ctrlOrAlt' && !isMacOS) {
                label = i18n('icu:Keyboard--Key--alt');
                isSquare = false;
              }
              if (key === 'optionOrAlt' && isMacOS) {
                label = i18n('icu:Keyboard--Key--option');
                isSquare = false;
              }
              if (key === 'optionOrAlt' && !isMacOS) {
                label = i18n('icu:Keyboard--Key--alt');
                isSquare = false;
              }
              if (key === 'ctrl') {
                label = i18n('icu:Keyboard--Key--ctrl');
                isSquare = false;
              }
              if (key === 'shift') {
                label = i18n('icu:Keyboard--Key--shift');
                isSquare = false;
              }
              if (key === 'enter') {
                label = i18n('icu:Keyboard--Key--enter');
                isSquare = false;
              }
              if (key === 'tab') {
                label = i18n('icu:Keyboard--Key--tab');
                isSquare = false;
              }
              if (key === '1 to 9') {
                label = i18n('icu:Keyboard--Key--one-to-nine-range');
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
