// Audio Player
import React, { useEffect, useRef, useState } from 'react';
import H5AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import { useDispatch, useSelector } from 'react-redux';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { setNextMessageToPlayId } from '../../state/ducks/conversations';
import {
  getNextMessageToPlayId,
  getSortedMessagesOfSelectedConversation,
  isMessageSelectionMode,
} from '../../state/selectors/conversations';
import { getAudioAutoplay } from '../../state/selectors/userConfig';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionIcon } from '../icon';

export const AudioPlayerWithEncryptedFile = (props: {
  src: string;
  contentType: string;
  messageId: string;
}) => {
  const { messageId, contentType, src } = props;
  const dispatch = useDispatch();
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const { urlToLoad } = useEncryptedFileFetch(src, contentType, false);
  const player = useRef<H5AudioPlayer | null>(null);

  const autoPlaySetting = useSelector(getAudioAutoplay);
  const messageProps = useSelector(getSortedMessagesOfSelectedConversation);
  const nextMessageToPlayId = useSelector(getNextMessageToPlayId);
  const multiSelectMode = useSelector(isMessageSelectionMode);

  useEffect(() => {
    // updates playback speed to value selected in context menu
    if (
      player.current?.audio.current &&
      player.current?.audio.current?.playbackRate !== playbackSpeed
    ) {
      player.current.audio.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, player]);

  useEffect(() => {
    if (messageId !== undefined && messageId === nextMessageToPlayId) {
      player.current?.audio.current?.play();
    }
  }, [messageId, nextMessageToPlayId, player]);

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
    const prevAuthorNumber = messageProps[justEndedMessageIndex].propsForMessage.sender;
    const nextAuthorNumber = messageProps[nextMessageIndex].propsForMessage.sender;
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
    if (autoPlaySetting === true && messageId) {
      triggerPlayNextMessageIfNeeded(messageId);
    }
  };

  return (
    <H5AudioPlayer
      src={urlToLoad}
      preload="metadata"
      style={{ pointerEvents: multiSelectMode ? 'none' : 'inherit' }}
      layout="horizontal-reverse"
      showSkipControls={false}
      autoPlay={false}
      autoPlayAfterSrcChange={false}
      showJumpControls={false}
      showDownloadProgress={false}
      listenInterval={100}
      onEnded={onEnded}
      ref={player}
      customControlsSection={[
        RHAP_UI.MAIN_CONTROLS,
        <div className="speedButton" key="togglePlaybackSpeed">
          <SessionButton
            text={`${playbackSpeed}x`}
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
          <SessionIcon iconType="play" iconSize="small" iconColor={'var(--color-text-subtle)'} />
        ),
        pause: (
          <SessionIcon iconType="pause" iconSize="small" iconColor={'var(--color-text-subtle)'} />
        ),
      }}
    />
  );
};
