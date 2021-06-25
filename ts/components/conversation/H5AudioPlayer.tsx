// Audio Player
import React, { useEffect, useRef, useState } from 'react';
import H5AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import { useTheme } from 'styled-components';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../session/SessionButton';

export const AudioPlayerWithEncryptedFile = (props: {
  src: string;
  contentType: string;
  playNextMessage?: (index: number) => void;
  playableMessageIndex?: number;
  nextMessageToPlay?: number;
}) => {
  const theme = useTheme();

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const { urlToLoad } = useEncryptedFileFetch(props.src, props.contentType);
  const player = useRef<H5AudioPlayer | null>(null);

  useEffect(() => {
    // updates playback speed to value selected in context menu
    if (player.current?.audio.current?.playbackRate) {
      player.current.audio.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (props.playableMessageIndex === props.nextMessageToPlay) {
      player.current?.audio.current?.play();
    }
  });

  const onEnded = () => {
    // if audio autoplay is enabled, call method to start playing
    // the next playable message
    if (
      window.inboxStore?.getState().userConfig.audioAutoplay === true &&
      props.playNextMessage &&
      props.playableMessageIndex !== undefined
    ) {
      props.playNextMessage(props.playableMessageIndex);
    }
  };

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
      customControlsSection={[
        RHAP_UI.MAIN_CONTROLS,
        RHAP_UI.VOLUME,
        <div className="speedButton" key="togglePlaybackSpeed">
          <SessionButton
            text={`${playbackSpeed}x`}
            theme={theme}
            onClick={() => {
              setPlaybackSpeed(playbackSpeed === 1 ? 1.5 : 1);
            }}
            buttonType={SessionButtonType.Simple}
            buttonColor={SessionButtonColor.None}
          />
        </div>,
      ]}
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
