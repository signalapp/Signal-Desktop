// Audio Player
import React, { useEffect, useRef } from 'react';
import H5AudioPlayer from 'react-h5-audio-player';
import { useSelector } from 'react-redux';
import { useTheme } from 'styled-components';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { getAudioAutoplay } from '../../state/selectors/userConfig';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';

export const AudioPlayerWithEncryptedFile = (props: {
  src: string;
  contentType: string;
  playbackSpeed: number;
  changeTestList?: any;
  shouldPlay?: boolean
  index?: number
  nextMessageToPlay?: number
}) => {
  const theme = useTheme();
  const { urlToLoad } = useEncryptedFileFetch(props.src, props.contentType);
  const { playbackSpeed } = props;
  const player = useRef<H5AudioPlayer | null>(null);

  useEffect(() => {
    // updates playback speed to value selected in context menu
    if (player.current?.audio.current?.playbackRate) {
      player.current.audio.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (props.index == props.nextMessageToPlay) {
      player.current?.audio.current?.play();
    }
  })

  const onEnded = () => {
    if (window.inboxStore?.getState().userConfig.audioAutoplay === true) {
      props.changeTestList(props.index);
    }
  }

  return (
    <H5AudioPlayer
      src={urlToLoad}
      layout="horizontal-reverse"
      showSkipControls={false}
      showJumpControls={false}
      showDownloadProgress={false}
      listenInterval={100}
      onEnded={onEnded}
      ref={player}
      customIcons={{
        play: (
          <SessionIcon
            iconType={SessionIconType.Play}
            iconSize={SessionIconSize.Small}
            iconColor={theme.colors.textColorSubtle}
            theme={theme}
          />
        ),
        pause: (
          <SessionIcon
            iconType={SessionIconType.Pause}
            iconSize={SessionIconSize.Small}
            iconColor={theme.colors.textColorSubtle}
            theme={theme}
          />
        ),
      }}
    />
  );
};
