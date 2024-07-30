// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MutableRefObject } from 'react';
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import type { PanelRenderType } from '../../types/Panels';
import * as log from '../../logging/log';
import { ContactDetail } from '../../components/conversation/ContactDetail';
import { PanelType } from '../../types/Panels';
import { SmartAllMedia } from './AllMedia';
import { SmartChatColorPicker } from './ChatColorPicker';
import { SmartConversationDetails } from './ConversationDetails';
import { SmartConversationNotificationsSettings } from './ConversationNotificationsSettings';
import { SmartGV1Members } from './GV1Members';
import { SmartGroupLinkManagement } from './GroupLinkManagement';
import { SmartGroupV2Permissions } from './GroupV2Permissions';
import { SmartMessageDetail } from './MessageDetail';
import { SmartPendingInvites } from './PendingInvites';
import { SmartStickerManager } from './StickerManager';
import { getConversationTitleForPanelType } from '../../util/getConversationTitleForPanelType';
import { getIntl } from '../selectors/user';
import {
  getIsPanelAnimating,
  getPanelInformation,
  getWasPanelAnimated,
} from '../selectors/conversations';
import { focusableSelector } from '../../util/focusableSelectors';
import { missingCaseError } from '../../util/missingCaseError';
import { useConversationsActions } from '../ducks/conversations';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const ANIMATION_CONFIG = {
  duration: 350,
  easing: 'cubic-bezier(0.17, 0.17, 0, 1)',
  fill: 'forwards' as const,
};

type AnimationProps<T> = {
  ref: MutableRefObject<HTMLDivElement | null>;
  keyframes: Array<T>;
};

function doAnimate({
  onAnimationStarted,
  onAnimationDone,
  overlay,
  panel,
}: {
  isRTL: boolean;
  onAnimationStarted: () => unknown;
  onAnimationDone: () => unknown;
  overlay: AnimationProps<{ backgroundColor: string }>;
  panel: AnimationProps<
    { transform: string } | { left: string } | { right: string }
  >;
}) {
  const animateNode = panel.ref.current;
  if (!animateNode) {
    return;
  }

  const overlayAnimation = overlay.ref.current?.animate(overlay.keyframes, {
    ...ANIMATION_CONFIG,
    id: 'panel-animation-overlay',
  });

  const animation = animateNode.animate(panel.keyframes, {
    ...ANIMATION_CONFIG,
    id: 'panel-animation',
  });

  onAnimationStarted();

  function onFinish() {
    onAnimationDone();
  }

  animation.addEventListener('finish', onFinish);

  return () => {
    overlayAnimation?.cancel();
    animation.removeEventListener('finish', onFinish);
    animation.cancel();
  };
}

export const ConversationPanel = memo(function ConversationPanel({
  conversationId,
}: {
  conversationId: string;
}) {
  const panelInformation = useSelector(getPanelInformation);
  const { panelAnimationDone, panelAnimationStarted } =
    useConversationsActions();

  const animateRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const i18n = useSelector(getIntl);
  const isRTL = i18n.getLocaleDirection() === 'rtl';

  const isAnimating = useSelector(getIsPanelAnimating);
  const wasAnimated = useSelector(getWasPanelAnimated);

  const [lastPanelDoneAnimating, setLastPanelDoneAnimating] =
    useState<PanelRenderType | null>(null);

  const wasAnimatedRef = useRef(wasAnimated);
  useEffect(() => {
    wasAnimatedRef.current = wasAnimated;
  }, [wasAnimated]);

  useEffect(() => {
    setLastPanelDoneAnimating(null);
  }, [panelInformation?.prevPanel]);

  const onAnimationDone = useCallback(
    (panel: PanelRenderType | null) => {
      setLastPanelDoneAnimating(panel);
      panelAnimationDone();
    },
    [panelAnimationDone]
  );

  useEffect(() => {
    if (prefersReducedMotion || wasAnimatedRef.current) {
      onAnimationDone(panelInformation?.prevPanel ?? null);
      return;
    }

    if (panelInformation?.direction === 'pop') {
      return doAnimate({
        isRTL,
        onAnimationDone: () => {
          onAnimationDone(panelInformation?.prevPanel ?? null);
        },
        onAnimationStarted: panelAnimationStarted,
        overlay: {
          ref: overlayRef,
          keyframes: [
            { backgroundColor: 'rgba(0, 0, 0, 0.2)' },
            { backgroundColor: 'rgba(0, 0, 0, 0)' },
          ],
        },
        panel: {
          ref: animateRef,
          keyframes: [
            { transform: 'translateX(0%)' },
            { transform: isRTL ? 'translateX(-100%)' : 'translateX(100%)' },
          ],
        },
      });
    }

    if (panelInformation?.direction === 'push') {
      return doAnimate({
        isRTL,
        onAnimationDone: () => {
          onAnimationDone(panelInformation?.prevPanel ?? null);
        },
        onAnimationStarted: panelAnimationStarted,
        overlay: {
          ref: overlayRef,
          keyframes: [
            { backgroundColor: 'rgba(0, 0, 0, 0)' },
            { backgroundColor: 'rgba(0, 0, 0, 0.2)' },
          ],
        },
        panel: {
          ref: animateRef,
          keyframes: [
            // Note that we can't use translateX here because it breaks
            // gradients for the message in message details screen.
            // See: https://issues.chromium.org/issues/327027598
            isRTL ? { right: '100%' } : { left: '100%' },
            isRTL ? { right: '0' } : { left: '0' },
          ],
        },
      });
    }

    return undefined;
  }, [
    isRTL,
    onAnimationDone,
    panelAnimationStarted,
    panelInformation?.currPanel,
    panelInformation?.direction,
    panelInformation?.prevPanel,
    prefersReducedMotion,
  ]);

  if (!panelInformation) {
    return null;
  }

  const { currPanel: activePanel, direction, prevPanel } = panelInformation;

  if (!direction) {
    return null;
  }

  if (direction === 'pop') {
    return (
      <>
        {activePanel && (
          <PanelContainer
            conversationId={conversationId}
            isActive
            panel={activePanel}
          />
        )}
        {lastPanelDoneAnimating !== prevPanel && (
          <div className="ConversationPanel__overlay" ref={overlayRef} />
        )}
        {prevPanel && lastPanelDoneAnimating !== prevPanel && (
          <PanelContainer
            conversationId={conversationId}
            panel={prevPanel}
            ref={animateRef}
          />
        )}
      </>
    );
  }

  if (direction === 'push' && activePanel) {
    return (
      <>
        {isAnimating && prevPanel && (
          <PanelContainer conversationId={conversationId} panel={prevPanel} />
        )}
        <div className="ConversationPanel__overlay" ref={overlayRef} />
        <PanelContainer
          conversationId={conversationId}
          isActive
          panel={activePanel}
          ref={animateRef}
        />
      </>
    );
  }

  return null;
});

type PanelPropsType = {
  conversationId: string;
  panel: PanelRenderType;
};

const PanelContainer = forwardRef<
  HTMLDivElement,
  PanelPropsType & { isActive?: boolean }
>(function PanelContainerInner(
  { conversationId, isActive, panel },
  ref
): JSX.Element {
  const i18n = useSelector(getIntl);
  const { popPanelForConversation } = useConversationsActions();
  const conversationTitle = getConversationTitleForPanelType(i18n, panel.type);

  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const focusNode = focusRef.current;
    if (!focusNode) {
      return;
    }

    const elements = focusNode.querySelectorAll<HTMLElement>(focusableSelector);
    if (!elements.length) {
      return;
    }
    elements[0]?.focus();
  }, [isActive, panel]);

  return (
    <div className="ConversationPanel" ref={ref}>
      <div className="ConversationPanel__header">
        <button
          aria-label={i18n('icu:goBack')}
          className="ConversationPanel__header__back-button"
          onClick={popPanelForConversation}
          type="button"
        />
        {conversationTitle && (
          <div className="ConversationPanel__header__info">
            <div className="ConversationPanel__header__info__title">
              {conversationTitle}
            </div>
          </div>
        )}
      </div>
      <div className="ConversationPanel__body" ref={focusRef}>
        <PanelElement conversationId={conversationId} panel={panel} />
      </div>
    </div>
  );
});

function PanelElement({
  conversationId,
  panel,
}: PanelPropsType): JSX.Element | null {
  const i18n = useSelector(getIntl);
  const { startConversation } = useConversationsActions();

  if (panel.type === PanelType.AllMedia) {
    return <SmartAllMedia conversationId={conversationId} />;
  }

  if (panel.type === PanelType.ChatColorEditor) {
    return <SmartChatColorPicker conversationId={conversationId} />;
  }

  if (panel.type === PanelType.ContactDetails) {
    const { contact, signalAccount } = panel.args;

    return (
      <ContactDetail
        contact={contact}
        hasSignalAccount={Boolean(signalAccount)}
        i18n={i18n}
        onSendMessage={() => {
          if (signalAccount) {
            startConversation(
              signalAccount.phoneNumber,
              signalAccount.serviceId
            );
          }
        }}
      />
    );
  }

  if (panel.type === PanelType.ConversationDetails) {
    return <SmartConversationDetails conversationId={conversationId} />;
  }

  if (panel.type === PanelType.GroupInvites) {
    return (
      <SmartPendingInvites
        conversationId={conversationId}
        ourAci={window.storage.user.getCheckedAci()}
      />
    );
  }

  if (panel.type === PanelType.GroupLinkManagement) {
    return <SmartGroupLinkManagement conversationId={conversationId} />;
  }

  if (panel.type === PanelType.GroupPermissions) {
    return <SmartGroupV2Permissions conversationId={conversationId} />;
  }

  if (panel.type === PanelType.GroupV1Members) {
    return <SmartGV1Members conversationId={conversationId} />;
  }

  if (panel.type === PanelType.MessageDetails) {
    return <SmartMessageDetail />;
  }

  if (panel.type === PanelType.NotificationSettings) {
    return (
      <SmartConversationNotificationsSettings conversationId={conversationId} />
    );
  }

  if (panel.type === PanelType.StickerManager) {
    return <SmartStickerManager />;
  }

  log.warn(missingCaseError(panel));
  return null;
}
