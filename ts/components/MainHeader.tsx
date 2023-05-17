// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import { usePopper } from 'react-popper';
import { createPortal } from 'react-dom';

import { showSettings } from '../shims/Whisper';
import { Avatar, AvatarSize } from './Avatar';
import { AvatarPopup } from './AvatarPopup';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { AvatarColorType } from '../types/Colors';
import type { BadgeType } from '../badges/types';
import { handleOutsideClick } from '../util/handleOutsideClick';

const EMPTY_OBJECT = Object.freeze(Object.create(null));

export type PropsType = {
  areStoriesEnabled: boolean;
  avatarPath?: string;
  badge?: BadgeType;
  color?: AvatarColorType;
  hasPendingUpdate: boolean;
  i18n: LocalizerType;
  isMe?: boolean;
  isVerified?: boolean;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  theme: ThemeType;
  title: string;
  hasFailedStorySends?: boolean;
  unreadStoriesCount: number;

  showArchivedConversations: () => void;
  startComposing: () => void;
  startUpdate: () => unknown;
  toggleProfileEditor: () => void;
  toggleStoriesView: () => unknown;
};

export function MainHeader({
  areStoriesEnabled,
  avatarPath,
  badge,
  color,
  hasFailedStorySends,
  hasPendingUpdate,
  i18n,
  name,
  phoneNumber,
  profileName,
  showArchivedConversations,
  startComposing,
  startUpdate,
  theme,
  title,
  toggleProfileEditor,
  toggleStoriesView,
  unreadStoriesCount,
}: PropsType): JSX.Element {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  const [showAvatarPopup, setShowAvatarPopup] = useState(false);

  const popper = usePopper(targetElement, popperElement, {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [null, 4],
        },
      },
    ],
  });

  useEffect(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    setPortalElement(div);
    return () => {
      div.remove();
      setPortalElement(null);
    };
  }, []);

  useEffect(() => {
    return handleOutsideClick(
      () => {
        if (!showAvatarPopup) {
          return false;
        }
        setShowAvatarPopup(false);
        return true;
      },
      {
        containerElements: [portalElement, targetElement],
        name: 'MainHeader.showAvatarPopup',
      }
    );
  }, [portalElement, targetElement, showAvatarPopup]);

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (showAvatarPopup && event.key === 'Escape') {
        setShowAvatarPopup(false);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [showAvatarPopup]);

  return (
    <div className="module-main-header">
      <div
        className="module-main-header__avatar--container"
        data-supertab
        ref={setTargetElement}
      >
        <Avatar
          aria-expanded={showAvatarPopup}
          aria-owns="MainHeader__AvatarPopup"
          acceptedMessageRequest
          avatarPath={avatarPath}
          badge={badge}
          className="module-main-header__avatar"
          color={color}
          conversationType="direct"
          i18n={i18n}
          isMe
          phoneNumber={phoneNumber}
          profileName={profileName}
          theme={theme}
          title={title}
          // `sharedGroupNames` makes no sense for yourself, but
          // `<Avatar>` needs it to determine blurring.
          sharedGroupNames={[]}
          size={AvatarSize.TWENTY_EIGHT}
          onClick={() => {
            setShowAvatarPopup(true);
          }}
        />
        {hasPendingUpdate && (
          <div className="module-main-header__avatar--badged" />
        )}
      </div>
      {showAvatarPopup &&
        portalElement != null &&
        createPortal(
          <div
            id="MainHeader__AvatarPopup"
            ref={setPopperElement}
            style={{ ...popper.styles.popper, zIndex: 10 }}
            {...popper.attributes.popper}
          >
            <AvatarPopup
              acceptedMessageRequest
              badge={badge}
              i18n={i18n}
              isMe
              color={color}
              conversationType="direct"
              name={name}
              phoneNumber={phoneNumber}
              profileName={profileName}
              theme={theme}
              title={title}
              avatarPath={avatarPath}
              hasPendingUpdate={hasPendingUpdate}
              // See the comment above about `sharedGroupNames`.
              sharedGroupNames={[]}
              onEditProfile={() => {
                toggleProfileEditor();
                setShowAvatarPopup(false);
              }}
              onStartUpdate={() => {
                startUpdate();
                setShowAvatarPopup(false);
              }}
              onViewPreferences={() => {
                showSettings();
                setShowAvatarPopup(false);
              }}
              onViewArchive={() => {
                showArchivedConversations();
                setShowAvatarPopup(false);
              }}
              style={EMPTY_OBJECT}
            />
          </div>,
          portalElement
        )}
      <div className="module-main-header__icon-container" data-supertab>
        {areStoriesEnabled && (
          <button
            aria-label={i18n('icu:stories')}
            className="module-main-header__stories-icon"
            onClick={toggleStoriesView}
            title={i18n('icu:stories')}
            type="button"
          >
            {hasFailedStorySends && (
              <span className="module-main-header__stories-badge">!</span>
            )}
            {!hasFailedStorySends && unreadStoriesCount ? (
              <span className="module-main-header__stories-badge">
                {unreadStoriesCount}
              </span>
            ) : undefined}
          </button>
        )}
        <button
          aria-label={i18n('icu:newConversation')}
          className="module-main-header__compose-icon"
          onClick={startComposing}
          title={i18n('icu:newConversation')}
          type="button"
        />
      </div>
    </div>
  );
}
