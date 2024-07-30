// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { VoiceNotesPlaybackProps } from '../../components/VoiceNotesPlaybackContext';
import { VoiceNotesPlaybackProvider } from '../../components/VoiceNotesPlaybackContext';
import { selectAudioPlayerActive } from '../selectors/audioPlayer';
import {
  AudioPlayerContent,
  useAudioPlayerActions,
} from '../ducks/audioPlayer';
import { globalMessageAudio } from '../../services/globalMessageAudio';
import { strictAssert } from '../../util/assert';
import { drop } from '../../util/drop';
import * as log from '../../logging/log';
import { Sound, SoundType } from '../../util/Sound';
import { getConversations } from '../selectors/conversations';
import { SeenStatus } from '../../MessageSeenStatus';
import { markViewed } from '../ducks/conversations';
import * as Errors from '../../types/errors';
import { usePrevious } from '../../hooks/usePrevious';

const stateChangeConfirmDownSound = new Sound({
  soundType: SoundType.VoiceNoteStart,
});
const stateChangeConfirmUpSound = new Sound({
  soundType: SoundType.VoiceNoteEnd,
});

/**
 * Synchronizes the audioPlayer redux state with globalMessageAudio
 */
export const SmartVoiceNotesPlaybackProvider = memo(
  function SmartVoiceNotesPlaybackProvider(props: VoiceNotesPlaybackProps) {
    const active = useSelector(selectAudioPlayerActive);
    const conversations = useSelector(getConversations);

    const previousStartPosition = usePrevious(undefined, active?.startPosition);

    const content = active?.content;
    let url: undefined | string;
    let messageId: undefined | string;
    let messageIdForLogging: undefined | string;
    let playNextConsecutiveSound = false;
    let playFinishConsecutiveSound = false;

    if (content && AudioPlayerContent.isVoiceNote(content)) {
      ({ url, id: messageId } = content.current);
      messageIdForLogging = content.current.messageIdForLogging;
      playNextConsecutiveSound = content.isConsecutive;
      playFinishConsecutiveSound =
        content.isConsecutive && content.queue.length === 0;
    }
    if (content && AudioPlayerContent.isDraft(content)) {
      url = content.url;
    }

    const {
      messageAudioEnded,
      currentTimeUpdated,
      durationChanged,
      unloadMessageAudio,
    } = useAudioPlayerActions();

    useEffect(() => {
      // if we don't have a new audio source
      // just control playback
      if (!content || !url || url === globalMessageAudio.url) {
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
          active.startPosition !== previousStartPosition &&
          globalMessageAudio.duration !== undefined
        ) {
          globalMessageAudio.currentTime =
            active.startPosition * globalMessageAudio.duration;
        }

        if (!active?.playing && globalMessageAudio.playing) {
          globalMessageAudio.pause();
        }

        if (active?.playing && !globalMessageAudio.playing) {
          globalMessageAudio.play();
        }

        if (active && active.playbackRate !== globalMessageAudio.playbackRate) {
          globalMessageAudio.playbackRate = active.playbackRate;
        }

        // if user requested a new position
        if (
          active &&
          active.startPosition !== undefined &&
          active.startPosition !== previousStartPosition &&
          active.duration
        ) {
          globalMessageAudio.currentTime =
            active.startPosition * active.duration;
        }
        return;
      }

      // if we have a new audio source
      loadAudio({
        url,
        playbackRate: active.playbackRate,
        messageId,
        messageIdForLogging,
        startPosition: active.startPosition,
        playFinishConsecutiveSound,
        durationChanged,
        unloadMessageAudio,
        currentTimeUpdated,
        messageAudioEnded,
      });

      if (playNextConsecutiveSound) {
        drop(
          (async () => {
            await stateChangeConfirmDownSound.play();
            globalMessageAudio.play();
          })()
        );
      } else {
        globalMessageAudio.play();
      }

      if (AudioPlayerContent.isVoiceNote(content)) {
        if (!content.current.isPlayed) {
          const message = conversations.messagesLookup[content.current.id];
          if (message && message.seenStatus !== SeenStatus.Unseen) {
            markViewed(content.current.id);
          }
        } else {
          log.info('SmartVoiceNotesPlaybackProvider: message already played', {
            message: content.current.messageIdForLogging,
          });
        }
      }
    }, [
      active,
      content,
      conversations.messagesLookup,
      currentTimeUpdated,
      durationChanged,
      messageAudioEnded,
      messageId,
      messageIdForLogging,
      playFinishConsecutiveSound,
      playNextConsecutiveSound,
      previousStartPosition,
      unloadMessageAudio,
      url,
    ]);

    return <VoiceNotesPlaybackProvider {...props} />;
  }
);

function loadAudio({
  url,
  playbackRate,
  messageId,
  messageIdForLogging,
  startPosition,
  playFinishConsecutiveSound,
  durationChanged,
  currentTimeUpdated,
  messageAudioEnded,
  unloadMessageAudio,
}: {
  url: string;
  playbackRate: number;
  messageId: string | undefined;
  messageIdForLogging: string | undefined;
  startPosition: number;
  playFinishConsecutiveSound: boolean;
  durationChanged: (value: number | undefined) => void;
  currentTimeUpdated: (value: number) => void;
  messageAudioEnded: () => void;
  unloadMessageAudio: () => void;
}) {
  globalMessageAudio.load({
    url,
    playbackRate,
    onLoadedMetadata() {
      strictAssert(
        globalMessageAudio.duration !== undefined,
        'Audio should have definite duration on `loadedmetadata` event'
      );
      log.info(
        'SmartVoiceNotesPlaybackProvider: `loadedmetadata` event',
        messageId
      );
      if (startPosition !== 0) {
        globalMessageAudio.currentTime =
          startPosition * globalMessageAudio.duration;
      }
      durationChanged(globalMessageAudio.duration);
    },
    onDurationChange() {
      log.info(
        'SmartVoiceNotesPlaybackProvider: `durationchange` event',
        messageId
      );
      durationChanged(globalMessageAudio.duration);
    },
    onTimeUpdate() {
      currentTimeUpdated(globalMessageAudio.currentTime);
    },
    onEnded() {
      if (playFinishConsecutiveSound) {
        drop(stateChangeConfirmUpSound.play());
      }
      messageAudioEnded();
    },
    onError(error) {
      log.error(
        'SmartVoiceNotesPlaybackProvider: playback error',
        messageIdForLogging,
        Errors.toLogFormat(error)
      );
      unloadMessageAudio();
    },
  });
}
