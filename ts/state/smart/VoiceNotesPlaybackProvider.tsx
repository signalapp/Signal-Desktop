// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { VoiceNotesPlaybackProps } from '../../components/VoiceNotesPlaybackContext';
import { VoiceNotesPlaybackProvider } from '../../components/VoiceNotesPlaybackContext';
import { selectAudioPlayerActive } from '../selectors/audioPlayer';
import { useAudioPlayerActions } from '../ducks/audioPlayer';
import { globalMessageAudio } from '../../services/globalMessageAudio';
import { strictAssert } from '../../util/assert';
import * as log from '../../logging/log';
import { Sound } from '../../util/Sound';
import { getConversations } from '../selectors/conversations';
import { SeenStatus } from '../../MessageSeenStatus';
import { markViewed } from '../ducks/conversations';
import * as Errors from '../../types/errors';
import { usePrevious } from '../../hooks/usePrevious';

const stateChangeConfirmUpSound = new Sound({
  src: 'sounds/state-change_confirm-up.ogg',
});
const stateChangeConfirmDownSound = new Sound({
  src: 'sounds/state-change_confirm-down.ogg',
});

/**
 * Synchronizes the audioPlayer redux state with globalMessageAudio
 */
export function SmartVoiceNotesPlaybackProvider(
  props: VoiceNotesPlaybackProps
): JSX.Element | null {
  const active = useSelector(selectAudioPlayerActive);
  const conversations = useSelector(getConversations);

  const previousStartPosition = usePrevious(undefined, active?.startPosition);

  const content = active?.content;
  const current = content?.current;
  const url = current?.url;

  const {
    messageAudioEnded,
    currentTimeUpdated,
    durationChanged,
    unloadMessageAudio,
  } = useAudioPlayerActions();

  useEffect(() => {
    // if we don't have a new audio source
    // just control playback
    if (!content || !current || !url || url === globalMessageAudio.url) {
      if (!active?.playing && globalMessageAudio.playing) {
        globalMessageAudio.pause();
      }

      if (active?.playing && !globalMessageAudio.playing) {
        globalMessageAudio.play();
      }

      if (active && active.playbackRate !== globalMessageAudio.playbackRate) {
        globalMessageAudio.playbackRate = active.playbackRate;
      }

      if (
        active &&
        active.startPosition !== undefined &&
        active.startPosition !== previousStartPosition
      ) {
        globalMessageAudio.currentTime =
          active.startPosition * globalMessageAudio.duration;
      }
      return;
    }

    // otherwise we have a new audio source
    // we just load it and play it
    globalMessageAudio.load({
      url,
      playbackRate: active.playbackRate,
      onLoadedMetadata() {
        strictAssert(
          !Number.isNaN(globalMessageAudio.duration),
          'Audio should have definite duration on `loadedmetadata` event'
        );
        log.info(
          'SmartVoiceNotesPlaybackProvider: `loadedmetadata` event',
          current.id
        );
        if (active.startPosition !== 0) {
          globalMessageAudio.currentTime =
            active.startPosition * globalMessageAudio.duration;
        }
      },
      onDurationChange() {
        log.info(
          'SmartVoiceNotesPlaybackProvider: `durationchange` event',
          current.id
        );
        const reportedDuration = globalMessageAudio.duration;

        // the underlying Audio element can return NaN if the audio hasn't loaded
        // we filter out 0 or NaN as they are not useful values downstream
        const newDuration =
          Number.isNaN(reportedDuration) || reportedDuration === 0
            ? undefined
            : reportedDuration;
        durationChanged(newDuration);
      },
      onTimeUpdate() {
        currentTimeUpdated(globalMessageAudio.currentTime);
      },
      onEnded() {
        if (content.isConsecutive && content.queue.length === 0) {
          void stateChangeConfirmDownSound.play();
        }
        messageAudioEnded();
      },
      onError(error) {
        log.error(
          'SmartVoiceNotesPlaybackProvider: playback error',
          current.messageIdForLogging,
          Errors.toLogFormat(error)
        );
        unloadMessageAudio();
      },
    });

    // if this message was part of the queue (consecutive, added indirectly)
    // we play a note to let the user we're onto a new message
    // (false for the first message in a consecutive group, since the user initiated it)
    if (content.isConsecutive) {
      // eslint-disable-next-line more/no-then
      void stateChangeConfirmUpSound.play().then(() => {
        globalMessageAudio.play();
      });
    } else {
      globalMessageAudio.play();
    }

    if (!current.isPlayed) {
      const message = conversations.messagesLookup[current.id];
      if (message && message.seenStatus !== SeenStatus.Unseen) {
        markViewed(current.id);
      }
    } else {
      log.info('SmartVoiceNotesPlaybackProvider: message already played', {
        message: current.messageIdForLogging,
      });
    }
  });

  return <VoiceNotesPlaybackProvider {...props} />;
}
