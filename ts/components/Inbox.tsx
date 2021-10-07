// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactNode, useEffect, useRef } from 'react';
import * as Backbone from 'backbone';
import {
  SafetyNumberChangeDialog,
  SafetyNumberProps,
} from './SafetyNumberChangeDialog';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';

type InboxViewType = Backbone.View & {
  onEmpty?: () => void;
};

type InboxViewOptionsType = Backbone.ViewOptions & {
  initialLoadComplete: boolean;
  window: typeof window;
};

export type PropsType = {
  cancelMessagesPendingConversationVerification: () => void;
  conversationsStoppingMessageSendBecauseOfVerification: Array<ConversationType>;
  hasInitialLoadCompleted: boolean;
  i18n: LocalizerType;
  isCustomizingPreferredReactions: boolean;
  numberOfMessagesPendingBecauseOfVerification: number;
  renderCustomizingPreferredReactionsModal: () => JSX.Element;
  renderSafetyNumber: (props: SafetyNumberProps) => JSX.Element;
  verifyConversationsStoppingMessageSend: () => void;
};

export const Inbox = ({
  cancelMessagesPendingConversationVerification,
  conversationsStoppingMessageSendBecauseOfVerification,
  hasInitialLoadCompleted,
  i18n,
  isCustomizingPreferredReactions,
  numberOfMessagesPendingBecauseOfVerification,
  renderCustomizingPreferredReactionsModal,
  renderSafetyNumber,
  verifyConversationsStoppingMessageSend,
}: PropsType): JSX.Element => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<InboxViewType | undefined>(undefined);

  useEffect(() => {
    const viewOptions: InboxViewOptionsType = {
      el: hostRef.current,
      initialLoadComplete: false,
      window,
    };
    const view = new window.Whisper.InboxView(viewOptions);

    viewRef.current = view;

    return () => {
      // [`Backbone.View.prototype.remove`][0] removes the DOM element and stops listening
      //   to event listeners. Because React will do the first, we only want to do the
      //   second.
      // [0]: https://github.com/jashkenas/backbone/blob/153dc41616a1f2663e4a86b705fefd412ecb4a7a/backbone.js#L1336-L1342
      viewRef.current?.stopListening();
      viewRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (hasInitialLoadCompleted && viewRef.current && viewRef.current.onEmpty) {
      viewRef.current.onEmpty();
    }
  }, [hasInitialLoadCompleted, viewRef]);

  let activeModal: ReactNode;
  if (conversationsStoppingMessageSendBecauseOfVerification.length) {
    const confirmText: string =
      numberOfMessagesPendingBecauseOfVerification === 1
        ? i18n('safetyNumberChangeDialog__pending-messages--1')
        : i18n('safetyNumberChangeDialog__pending-messages--many', [
            numberOfMessagesPendingBecauseOfVerification.toString(),
          ]);
    activeModal = (
      <SafetyNumberChangeDialog
        confirmText={confirmText}
        contacts={conversationsStoppingMessageSendBecauseOfVerification}
        i18n={i18n}
        onCancel={cancelMessagesPendingConversationVerification}
        onConfirm={verifyConversationsStoppingMessageSend}
        renderSafetyNumber={renderSafetyNumber}
      />
    );
  }
  if (!activeModal && isCustomizingPreferredReactions) {
    activeModal = renderCustomizingPreferredReactionsModal();
  }

  return (
    <>
      <div className="inbox index" ref={hostRef} />
      {activeModal}
    </>
  );
};
