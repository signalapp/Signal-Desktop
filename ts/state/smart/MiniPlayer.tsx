// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { MiniPlayer, PlayerState } from '../../components/MiniPlayer';
import type { Props as DumbProps } from '../../components/MiniPlayer';
import {
  AudioPlayerContent,
  useAudioPlayerActions,
} from '../ducks/audioPlayer';
import {
  selectAudioPlayerActive,
  selectVoiceNoteTitle,
} from '../selectors/audioPlayer';
import { getIntl } from '../selectors/user';

type Props = Pick<DumbProps, 'shouldFlow'>;

/**
 * Wires the dispatch props and shows/hides the MiniPlayer
 *
 * It also triggers side-effecting actions (actual playback) in response to changes in
 * the state
 */
export const SmartMiniPlayer = memo(function SmartMiniPlayer({
  shouldFlow,
}: Props): JSX.Element | null {
  const i18n = useSelector(getIntl);
  const active = useSelector(selectAudioPlayerActive);
  const getVoiceNoteTitle = useSelector(selectVoiceNoteTitle);
  const { setIsPlaying, setPlaybackRate, unloadMessageAudio } =
    useAudioPlayerActions();
  const handlePlay = useCallback(() => setIsPlaying(true), [setIsPlaying]);
  const handlePause = useCallback(() => setIsPlaying(false), [setIsPlaying]);

  if (!active) {
    return null;
  }

  const { content } = active;

  const url = AudioPlayerContent.isVoiceNote(content)
    ? content.current.url
    : content.url;

  let state = PlayerState.loading;
  if (url) {
    state = active.playing ? PlayerState.playing : PlayerState.paused;
  }

  const title = AudioPlayerContent.isDraft(content)
    ? i18n('icu:you')
    : getVoiceNoteTitle(content.current);

  return (
    <MiniPlayer
      i18n={i18n}
      title={title}
      onPlay={handlePlay}
      onPause={handlePause}
      onPlaybackRate={setPlaybackRate}
      onClose={unloadMessageAudio}
      shouldFlow={shouldFlow}
      state={state}
      currentTime={active.currentTime}
      duration={active.duration}
      playbackRate={active.playbackRate}
    />
  );
});
