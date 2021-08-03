// Audio Player
import React, { useEffect, useRef, useState } from 'react';
import H5AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from 'styled-components';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { setNextMessageToPlayId } from '../../state/ducks/conversations';
import {
  getNextMessageToPlayId,
  getSortedMessagesOfSelectedConversation,
} from '../../state/selectors/conversations';
import { getAudioAutoplay } from '../../state/selectors/userConfig';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../session/SessionButton';

export const AudioPlayerWithEncryptedFile = (props: {
  src: string;
  contentType: string;
  messageId: string;
}) => {
  const theme = useTheme();

  const dispatch = useDispatch();
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const { urlToLoad } = useEncryptedFileFetch(props.src, props.contentType);
  const player = useRef<H5AudioPlayer | null>(null);

  const autoPlaySetting = useSelector(getAudioAutoplay);
  const messageProps = useSelector(getSortedMessagesOfSelectedConversation);
  const nextMessageToPlayId = useSelector(getNextMessageToPlayId);

  useEffect(() => {
    // updates playback speed to value selected in context menu
    if (player.current?.audio.current?.playbackRate) {
      player.current.audio.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, player]);

  useEffect(() => {
    if (props.messageId === nextMessageToPlayId) {
      player.current?.audio.current?.play();
    }
  }, [props.messageId, nextMessageToPlayId, player]);

  const triggerPlayNextMessageIfNeeded = (endedMessageId: string) => {
    const justEndedMessageIndex = messageProps.findIndex(
      m => m.propsForMessage.id === endedMessageId
    );
    if (justEndedMessageIndex === -1) {
      // make sure that even with switching convo or stuff, the next message to play is unset
      dispatch(setNextMessageToPlayId(undefined));

      return;
    }

    const isLastMessage = justEndedMessageIndex === 0;

    // to prevent autoplaying as soon as a message is received.
    if (isLastMessage) {
      dispatch(setNextMessageToPlayId(undefined));
      return;
    }
    // justEndedMessageIndex cannot be -1 nor 0, so it is >= 1
    const nextMessageIndex = justEndedMessageIndex - 1;
    // stop auto-playing when the audio messages change author.
    const prevAuthorNumber = messageProps[justEndedMessageIndex].propsForMessage.authorPhoneNumber;
    const nextAuthorNumber = messageProps[nextMessageIndex].propsForMessage.authorPhoneNumber;
    const differentAuthor = prevAuthorNumber !== nextAuthorNumber;
    if (differentAuthor) {
      dispatch(setNextMessageToPlayId(undefined));
    } else {
      dispatch(setNextMessageToPlayId(messageProps[nextMessageIndex].propsForMessage.id));
    }
  };

  const onEnded = () => {
    // if audio autoplay is enabled, call method to start playing
    // the next playable message
    if (autoPlaySetting === true && props.messageId) {
      triggerPlayNextMessageIfNeeded(props.messageId);
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
