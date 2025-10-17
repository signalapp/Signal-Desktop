// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, useRef } from 'react';
import type {
  ActiveCallType,
  ObservedRemoteMuteType,
} from '../types/Calling.std.js';
import { CallMode } from '../types/CallDisposition.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../types/Util.std.js';
import { CallingToastProvider, useCallingToasts } from './CallingToast.dom.js';
import { usePrevious } from '../hooks/usePrevious.std.js';
import { difference as setDifference } from '../util/setUtil.std.js';
import { isMoreRecentThan } from '../util/timestamp.std.js';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall.std.js';
import { SECOND } from '../util/durations/index.std.js';
import type { SetMutedByType } from '../state/ducks/calling.preload.js';

type PropsType = {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
};

const ME = Symbol('me');

function getCurrentPresenter(
  activeCall: Readonly<ActiveCallType>
): ConversationType | { id: typeof ME } | undefined {
  if (activeCall.presentingSource) {
    return { id: ME };
  }
  if (
    activeCall.callMode === CallMode.Direct &&
    activeCall.conversation.type === 'direct'
  ) {
    const isOtherPersonPresenting = activeCall.remoteParticipants.some(
      participant => participant.presenting
    );
    return isOtherPersonPresenting ? activeCall.conversation : undefined;
  }
  if (isGroupOrAdhocActiveCall(activeCall)) {
    return activeCall.remoteParticipants.find(
      participant => participant.presenting
    );
  }
  return undefined;
}

export function useScreenSharingStoppedToast({
  activeCall,
  i18n,
}: PropsType): void {
  const { showToast, hideToast } = useCallingToasts();

  const SOMEONE_STOPPED_PRESENTING_TOAST_KEY = 'someone_stopped_presenting';

  const currentPresenter = useMemo(
    () => getCurrentPresenter(activeCall),
    [activeCall]
  );
  const previousPresenter = usePrevious(currentPresenter, currentPresenter);

  useEffect(() => {
    if (previousPresenter && !currentPresenter) {
      hideToast(SOMEONE_STOPPED_PRESENTING_TOAST_KEY);
      showToast({
        key: SOMEONE_STOPPED_PRESENTING_TOAST_KEY,
        content:
          previousPresenter.id === ME
            ? i18n('icu:calling__presenting--you-stopped')
            : i18n('icu:calling__presenting--person-stopped', {
                name: previousPresenter.title,
              }),
        autoClose: true,
      });
    }
  }, [
    activeCall,
    hideToast,
    currentPresenter,
    previousPresenter,
    showToast,
    i18n,
  ]);
}

function useMutedToast({
  hasLocalAudio,
  mutedBy,
  i18n,
}: {
  hasLocalAudio: boolean;
  mutedBy: number | undefined;
  i18n: LocalizerType;
}): void {
  const previousHasLocalAudio = usePrevious(hasLocalAudio, hasLocalAudio);
  const { showToast, hideToast } = useCallingToasts();
  const MUTED_TOAST_KEY = 'muted';

  useEffect(() => {
    if (
      previousHasLocalAudio !== undefined &&
      hasLocalAudio !== previousHasLocalAudio &&
      mutedBy === undefined // skip this if we were muted by someone
    ) {
      hideToast(MUTED_TOAST_KEY);
      showToast({
        key: MUTED_TOAST_KEY,
        content: hasLocalAudio
          ? i18n('icu:CallControls__MutedToast--unmuted')
          : i18n('icu:CallControls__MutedToast--muted'),
        autoClose: true,
        dismissable: true,
      });
    }
  }, [
    hasLocalAudio,
    previousHasLocalAudio,
    hideToast,
    showToast,
    mutedBy,
    i18n,
  ]);
}

function useOutgoingRingToast({
  outgoingRing,
  i18n,
}: {
  outgoingRing?: boolean;
  i18n: LocalizerType;
}): void {
  const { showToast, hideToast } = useCallingToasts();
  const previousOutgoingRing = usePrevious(outgoingRing, outgoingRing);
  const RINGING_TOAST_KEY = 'ringing';

  React.useEffect(() => {
    if (outgoingRing === undefined) {
      return;
    }

    if (
      previousOutgoingRing !== undefined &&
      outgoingRing !== previousOutgoingRing
    ) {
      hideToast(RINGING_TOAST_KEY);
      showToast({
        key: RINGING_TOAST_KEY,
        content: outgoingRing
          ? i18n('icu:CallControls__RingingToast--ringing-on')
          : i18n('icu:CallControls__RingingToast--ringing-off'),
        autoClose: true,
        dismissable: true,
      });
    }
  }, [outgoingRing, previousOutgoingRing, hideToast, showToast, i18n]);
}

function useRaisedHandsToast({
  raisedHands,
  renderRaisedHandsToast,
}: {
  raisedHands?: Set<number>;
  renderRaisedHandsToast?: (
    hands: Array<number>
  ) => JSX.Element | string | undefined;
}): void {
  const RAISED_HANDS_TOAST_KEY = 'raised-hands';
  const RAISED_HANDS_TOAST_LIFETIME = 4000;
  const LOAD_DELAY = 2000;

  const { showToast, hideToast } = useCallingToasts();

  // Hand state is updated after a delay upon joining a call, so it can appear that
  // hands were raised immediately when you join a call. To avoid spurious toasts, add
  // an initial delay before showing toasts.
  const [isLoaded, setIsLoaded] = React.useState<boolean>(false);
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoaded(true);
    }, LOAD_DELAY);
    return () => clearTimeout(timeout);
  }, []);

  const previousRaisedHands = usePrevious(raisedHands, raisedHands);
  const [newHands, loweredHands]: [Set<number>, Set<number>] = isLoaded
    ? [
        setDifference(
          raisedHands ?? new Set(),
          previousRaisedHands ?? new Set()
        ),
        setDifference(
          previousRaisedHands ?? new Set(),
          raisedHands ?? new Set()
        ),
      ]
    : [new Set(), new Set()];

  const toastLastShownAt = useRef<number>(0);
  const handsForLastShownToast = useRef<Set<number>>(new Set());

  React.useEffect(() => {
    if (raisedHands?.size === 0) {
      hideToast(RAISED_HANDS_TOAST_KEY);
    }

    if (
      (newHands.size === 0 && loweredHands.size === 0) ||
      !renderRaisedHandsToast
    ) {
      return;
    }

    // If there's an existing raised hand toast (it hasn't faded out yet), then
    // group the newly raised and lowered hands into the existing toast.
    let handsForToast: Array<number>;
    if (
      isMoreRecentThan(toastLastShownAt.current, RAISED_HANDS_TOAST_LIFETIME)
    ) {
      handsForToast = [
        ...setDifference(handsForLastShownToast.current, loweredHands),
        ...newHands,
      ];

      // If someone lowered a hand which isn't present in the existing toast,
      // we can ignore it.
      if (
        newHands.size === 0 &&
        loweredHands.size > 0 &&
        handsForToast.length &&
        handsForToast.length === handsForLastShownToast.current.size
      ) {
        return;
      }
    } else {
      handsForToast = [...newHands];
    }
    handsForLastShownToast.current = new Set([...handsForToast]);

    hideToast(RAISED_HANDS_TOAST_KEY);

    const content = renderRaisedHandsToast(handsForToast.reverse());
    if (!content) {
      return;
    }

    // Note: Don't set { dismissable: true } or else the links (Lower or View Queue)
    // will cause nested buttons (dismissable toasts are <button>s)
    showToast({
      key: RAISED_HANDS_TOAST_KEY,
      content,
      autoClose: true,
      lifetime: RAISED_HANDS_TOAST_LIFETIME,
    });
    toastLastShownAt.current = Date.now();
  }, [
    raisedHands,
    previousRaisedHands,
    newHands,
    handsForLastShownToast,
    loweredHands,
    renderRaisedHandsToast,
    hideToast,
    showToast,
  ]);
}

function useLowerHandSuggestionToast({
  suggestLowerHand,
  handleLowerHand,
  i18n,
  isHandRaised,
}: {
  suggestLowerHand: boolean | undefined;
  i18n: LocalizerType;
  handleLowerHand: (() => void) | undefined;
  isHandRaised: boolean | undefined;
}): void {
  const previousSuggestLowerHand = usePrevious(
    suggestLowerHand,
    suggestLowerHand
  );
  const { showToast, hideToast } = useCallingToasts();
  const SUGGEST_LOWER_HAND_TOAST_KEY = 'SUGGEST_LOWER_HAND_TOAST_KEY';

  useEffect(() => {
    if (!handleLowerHand) {
      return;
    }
    if (
      previousSuggestLowerHand !== undefined &&
      suggestLowerHand !== previousSuggestLowerHand
    ) {
      if (suggestLowerHand && isHandRaised) {
        showToast({
          key: SUGGEST_LOWER_HAND_TOAST_KEY,
          content: (
            <div className="CallingRaisedHandsToast__Content">
              <span className="CallingRaisedHandsToast__HandIcon" />
              {i18n('icu:CallControls__LowerHandSuggestionToast')}
              <button
                className="CallingRaisedHandsToasts__Link"
                type="button"
                onClick={() => {
                  handleLowerHand();
                  hideToast(SUGGEST_LOWER_HAND_TOAST_KEY);
                }}
              >
                {i18n('icu:CallControls__LowerHandSuggestionToast--button')}
              </button>
            </div>
          ),
          dismissable: false,
          autoClose: true,
          lifetime: 10 * SECOND,
        });
      }
    }
  }, [
    suggestLowerHand,
    handleLowerHand,
    previousSuggestLowerHand,
    hideToast,
    showToast,
    SUGGEST_LOWER_HAND_TOAST_KEY,
    isHandRaised,
    i18n,
  ]);

  useEffect(() => {
    if (!isHandRaised) {
      hideToast(SUGGEST_LOWER_HAND_TOAST_KEY);
    }
  }, [isHandRaised, hideToast]);
}

function useMutedByToast({
  mutedBy,
  setLocalAudioRemoteMuted,
  conversationsByDemuxId,
  i18n,
}: {
  mutedBy: number | undefined;
  setLocalAudioRemoteMuted?: SetMutedByType;
  conversationsByDemuxId?: Map<number, ConversationType>;
  i18n: LocalizerType;
}): void {
  const previousMutedBy = usePrevious(mutedBy, mutedBy);

  const { showToast, hideToast } = useCallingToasts();
  const MUTED_BY_TOAST_KEY = 'MUTED_BY_TOAST_KEY';

  useEffect(() => {
    if (setLocalAudioRemoteMuted === undefined) {
      return;
    }
    if (
      mutedBy === undefined ||
      // if it's undefined, likely we just received a remote mute request
      // and hadn't had one before.
      (previousMutedBy !== undefined && previousMutedBy === mutedBy) ||
      conversationsByDemuxId === undefined
    ) {
      return;
    }
    const otherConversation = conversationsByDemuxId.get(mutedBy);
    const title = otherConversation?.title;
    if (title === undefined) {
      return;
    }
    setLocalAudioRemoteMuted({ mutedBy });
    let content;
    if (otherConversation?.isMe) {
      content = i18n('icu:CallControls__YouMutedYourselfToast');
    } else {
      content = i18n('icu:CallControls__MutedBySomeoneToast', {
        otherName: title,
      });
    }
    hideToast(MUTED_BY_TOAST_KEY);
    showToast({
      key: MUTED_BY_TOAST_KEY,
      content,
      dismissable: true,
      autoClose: true,
      lifetime: 10 * SECOND,
    });
  }, [
    mutedBy,
    previousMutedBy,
    conversationsByDemuxId,
    i18n,
    showToast,
    hideToast,
    MUTED_BY_TOAST_KEY,
    setLocalAudioRemoteMuted,
  ]);
}

function useObservedRemoteMuteToast({
  observedRemoteMute,
  conversationsByDemuxId,
  i18n,
}: {
  observedRemoteMute: ObservedRemoteMuteType | undefined;
  conversationsByDemuxId?: Map<number, ConversationType>;
  i18n: LocalizerType;
}): void {
  const { showToast, hideToast } = useCallingToasts();
  const OBSERVED_REMOTE_MUTE_TOAST_KEY = 'OBSERVED_REMOTE_MUTE_TOAST_KEY';
  const previousObservedRemoteMute = usePrevious(
    observedRemoteMute,
    observedRemoteMute
  );
  useEffect(() => {
    if (
      observedRemoteMute === undefined ||
      (previousObservedRemoteMute !== undefined &&
        previousObservedRemoteMute === observedRemoteMute) ||
      conversationsByDemuxId === undefined
    ) {
      return;
    }

    const sourceConversation = conversationsByDemuxId.get(
      observedRemoteMute.source
    );
    const targetConversation = conversationsByDemuxId.get(
      observedRemoteMute.target
    );
    if (sourceConversation?.serviceId === targetConversation?.serviceId) {
      // Ignore self-mutes.
      return;
    }
    const targetTitle = targetConversation?.title;
    if (targetTitle === undefined) {
      return;
    }
    let content;
    if (sourceConversation?.isMe) {
      content = i18n('icu:CallControls__YouMutedSomeoneToast', {
        otherName: targetTitle,
      });
    } else {
      const sourceTitle = sourceConversation?.title;
      if (sourceTitle === undefined) {
        return;
      }
      content = i18n('icu:CallControls__SomeoneMutedSomeoneToast', {
        name: sourceTitle,
        otherName: targetTitle,
      });
    }

    hideToast(OBSERVED_REMOTE_MUTE_TOAST_KEY);
    showToast({
      key: OBSERVED_REMOTE_MUTE_TOAST_KEY,
      content,
      dismissable: true,
      autoClose: true,
      lifetime: 10 * SECOND,
    });
  }, [
    observedRemoteMute,
    previousObservedRemoteMute,
    conversationsByDemuxId,
    i18n,
    showToast,
    hideToast,
    OBSERVED_REMOTE_MUTE_TOAST_KEY,
  ]);
}

type CallingButtonToastsType = {
  hasLocalAudio: boolean;
  outgoingRing: boolean | undefined;
  raisedHands?: Set<number>;
  renderRaisedHandsToast?: (
    hands: Array<number>
  ) => JSX.Element | string | undefined;
  suggestLowerHand?: boolean;
  isHandRaised?: boolean;
  handleLowerHand?: () => void;
  mutedBy?: number;
  observedRemoteMute?: ObservedRemoteMuteType;
  conversationsByDemuxId?: Map<number, ConversationType>;
  i18n: LocalizerType;
  setLocalAudioRemoteMuted?: SetMutedByType;
};

export function CallingButtonToastsContainer(
  props: CallingButtonToastsType
): JSX.Element {
  const toastRegionRef = useRef<HTMLDivElement>(null);
  return (
    <CallingToastProvider
      i18n={props.i18n}
      maxNonPersistentToasts={1}
      region={toastRegionRef}
    >
      <div className="CallingButtonToasts__outer">
        <div className="CallingButtonToasts" ref={toastRegionRef} />
        <CallingButtonToasts {...props} />
      </div>
    </CallingToastProvider>
  );
}

function CallingButtonToasts({
  hasLocalAudio,
  outgoingRing,
  raisedHands,
  renderRaisedHandsToast,
  suggestLowerHand,
  handleLowerHand,
  isHandRaised,
  i18n,
  mutedBy,
  observedRemoteMute,
  conversationsByDemuxId,
  setLocalAudioRemoteMuted,
}: CallingButtonToastsType) {
  useMutedToast({ hasLocalAudio, mutedBy, i18n });
  useOutgoingRingToast({ outgoingRing, i18n });
  useRaisedHandsToast({ raisedHands, renderRaisedHandsToast });
  useLowerHandSuggestionToast({
    suggestLowerHand,
    i18n,
    handleLowerHand,
    isHandRaised,
  });
  useMutedByToast({
    mutedBy,
    setLocalAudioRemoteMuted,
    conversationsByDemuxId,
    i18n,
  });
  useObservedRemoteMuteToast({
    observedRemoteMute,
    conversationsByDemuxId,
    i18n,
  });

  return null;
}
