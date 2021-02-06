// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactPortal } from 'react';
import classNames from 'classnames';
import { createPortal } from 'react-dom';

import { ConversationType } from '../../state/ducks/conversations';
import { About } from './About';
import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';

export type PropsType = {
  areWeAdmin: boolean;
  contact?: ConversationType;
  readonly i18n: LocalizerType;
  isAdmin: boolean;
  isMember: boolean;
  onClose: () => void;
  openConversation: (conversationId: string) => void;
  removeMember: (conversationId: string) => void;
  showSafetyNumber: (conversationId: string) => void;
  toggleAdmin: (conversationId: string) => void;
};

export const ContactModal = ({
  areWeAdmin,
  contact,
  i18n,
  isAdmin,
  isMember,
  onClose,
  openConversation,
  removeMember,
  showSafetyNumber,
  toggleAdmin,
}: PropsType): ReactPortal | null => {
  if (!contact) {
    throw new Error('Contact modal opened without a matching contact');
  }

  const [root, setRoot] = React.useState<HTMLElement | null>(null);
  const overlayRef = React.useRef<HTMLElement | null>(null);
  const closeButtonRef = React.useRef<HTMLElement | null>(null);
  const [fadeout, setFadeout] = React.useState(false);

  const close = React.useCallback(() => {
    if (!fadeout) {
      setFadeout(true);
      setTimeout(() => {
        onClose();
      }, 150);
    }
  }, [fadeout, setFadeout, onClose]);

  React.useEffect(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    setRoot(div);

    return () => {
      document.body.removeChild(div);
      setRoot(null);
    };
  }, []);

  React.useEffect(() => {
    if (root !== null && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [root]);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();

        close();
      }
    };
    document.addEventListener('keyup', handler);

    return () => {
      document.removeEventListener('keyup', handler);
    };
  }, [close]);

  const onClickOverlay = (e: React.MouseEvent<HTMLElement>) => {
    if (e.target === overlayRef.current) {
      e.preventDefault();
      e.stopPropagation();

      close();
    }
  };

  return root
    ? createPortal(
        <div
          ref={ref => {
            overlayRef.current = ref;
          }}
          role="presentation"
          className={classNames(
            'module-contact-modal__overlay',
            fadeout ? 'fadeout' : null
          )}
          onClick={onClickOverlay}
        >
          <div className="module-contact-modal">
            <button
              ref={r => {
                closeButtonRef.current = r;
              }}
              type="button"
              className="module-contact-modal__close-button"
              onClick={close}
              aria-label={i18n('close')}
            />
            <Avatar
              avatarPath={contact.avatarPath}
              color={contact.color}
              conversationType="direct"
              i18n={i18n}
              name={contact.name}
              profileName={contact.profileName}
              size={96}
              title={contact.title}
            />
            <div className="module-contact-modal__name">{contact.title}</div>
            <div className="module-about__container">
              <About text={contact.about} />
            </div>
            {contact.phoneNumber && (
              <div className="module-contact-modal__profile-and-number">
                {contact.phoneNumber}
              </div>
            )}
            <div className="module-contact-modal__button-container">
              <button
                type="button"
                className="module-contact-modal__button module-contact-modal__send-message"
                onClick={() => openConversation(contact.id)}
              >
                <div className="module-contact-modal__bubble-icon">
                  <div className="module-contact-modal__send-message__bubble-icon" />
                </div>
                <span>{i18n('ContactModal--message')}</span>
              </button>
              {!contact.isMe && (
                <button
                  type="button"
                  className="module-contact-modal__button module-contact-modal__safety-number"
                  onClick={() => showSafetyNumber(contact.id)}
                >
                  <div className="module-contact-modal__bubble-icon">
                    <div className="module-contact-modal__safety-number__bubble-icon" />
                  </div>
                  <span>{i18n('showSafetyNumber')}</span>
                </button>
              )}
              {!contact.isMe && areWeAdmin && isMember && (
                <>
                  <button
                    type="button"
                    className="module-contact-modal__button module-contact-modal__make-admin"
                    onClick={() => toggleAdmin(contact.id)}
                  >
                    <div className="module-contact-modal__bubble-icon">
                      <div className="module-contact-modal__make-admin__bubble-icon" />
                    </div>
                    {isAdmin ? (
                      <span>{i18n('ContactModal--rm-admin')}</span>
                    ) : (
                      <span>{i18n('ContactModal--make-admin')}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="module-contact-modal__button module-contact-modal__remove-from-group"
                    onClick={() => removeMember(contact.id)}
                  >
                    <div className="module-contact-modal__bubble-icon">
                      <div className="module-contact-modal__remove-from-group__bubble-icon" />
                    </div>
                    <span>{i18n('ContactModal--remove-from-group')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        root
      )
    : null;
};
