// Audio Player
import React, { createRef, useEffect } from 'react';
import H5AudioPlayer from 'react-h5-audio-player';
import { useTheme } from 'styled-components';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';

export const AudioPlayerWithEncryptedFile = (props: {
  src: string;
  contentType: string;
  playbackSpeed: number;
}) => {
  const theme = useTheme();
  const { urlToLoad } = useEncryptedFileFetch(props.src, props.contentType);
  const { playbackSpeed } = props;
  const player = createRef<H5AudioPlayer>();

  useEffect(() => {
    // updates playback speed to value selected in context menu
    if (player.current?.audio.current?.playbackRate) {
      player.current.audio.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  return (
    <H5AudioPlayer
      src={urlToLoad}
      layout="horizontal-reverse"
      showSkipControls={false}
      showJumpControls={false}
      showDownloadProgress={false}
      listenInterval={100}
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
