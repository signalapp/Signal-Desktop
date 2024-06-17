// Audio Player
import { useEffect, useRef, useState } from 'react';
import H5AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { setNextMessageToPlayId } from '../../state/ducks/conversations';
import { useMessageSelected } from '../../state/selectors';
import {
  getNextMessageToPlayId,
  getSortedMessagesOfSelectedConversation,
  isMessageSelectionMode,
} from '../../state/selectors/conversations';
import { getAudioAutoplay } from '../../state/selectors/userConfig';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SessionIcon } from '../icon';

const StyledSpeedButton = styled.div`
  padding: var(--margins-xs);
  transition: none;

  .session-button {
    transition: none;
    width: 34px;
    padding: 0px;
  }
`;

export const StyledH5AudioPlayer = styled(H5AudioPlayer)<{ dropShadow?: boolean }>`
  &.rhap_container {
    min-width: 220px;
    padding: 0px;
    outline: none;
    padding: var(--padding-message-content);
    border-radius: var(--border-radius-message-box);

    svg {
      transition: fill var(--default-duration);
    }

    button {
      outline: none;
    }
  }

  .rhap_progress-container {
    margin: 0 0 0 calc(10px + 1%);
    outline: none;
  }

  .rhap_total-time {
    display: none;
  }

  .rhap_current-time {
    margin: 0 5px 0 4px;
    flex-shrink: 0;
  }

  .rhap_play-pause-button {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .rhap_volume-bar {
    display: none;
  }

  .rhap_volume-button {
    .module-message__container--incoming & {
      color: var(--message-bubbles-received-text-color);
    }
    .module-message__container--outgoing & {
      color: var(--message-bubbles-sent-text-color);
    }
  }

  .rhap_volume-container div[role='progressbar'] {
    display: none;
  }

  .rhap_time {
    .module-message__container--incoming & {
      color: var(--message-bubbles-received-text-color);
    }
    .module-message__container--outgoing & {
      color: var(--message-bubbles-sent-text-color);
    }

    font-size: 12px;
  }

  .rhap_progress-bar {
    box-sizing: border-box;
    position: relative;
    z-index: 0;
    width: 100%;
    height: 5px;
    border-radius: 2px;
  }

  .rhap_progress-filled {
    padding-left: 5px;
  }

  .rhap_download-progress {
    height: 100%;
    position: absolute;
    z-index: 1;
    border-radius: 2px;
  }

  .rhap_progress-indicator {
    z-index: 3;
    width: 15px;
    height: 15px;
    top: -5px;
    margin-left: -10px;
    box-shadow: rgba(0, 0, 0, 0.5) 0 0 5px !important;
  }

  .rhap_controls-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rhap_additional-controls {
    display: none;
  }

  .rhap_play-pause-button {
    width: unset;
    height: unset;
  }

  .rhap_controls-section {
    flex: unset;
    justify-content: flex-start;
  }

  .rhap_volume-button {
    font-size: 20px;
    width: 20px;
    height: 20px;
    margin-right: 0px;
  }

  ${props => props.dropShadow && 'box-shadow: var(--drop-shadow);'}
`;

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
  const selected = useMessageSelected(messageId);

  const dataTestId = `audio-${messageId}`;

  useEffect(() => {
    // Updates datatestId once rendered
    if (
      player.current?.audio.current &&
      player.current?.container.current &&
      player.current.container.current.dataset.testId !== dataTestId
    ) {
      // NOTE we can't assign the value using dataset.testId because the result is data-test-id not data-testid which is our convention
      player.current.container.current.setAttribute('data-testid', dataTestId);
    }
  }, [dataTestId, player]);

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
      void player.current?.audio.current?.play();
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
    <StyledH5AudioPlayer
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
        <StyledSpeedButton key="togglePlaybackSpeed">
          <SessionButton
            text={`${playbackSpeed}x`}
            onClick={() => {
              setPlaybackSpeed(playbackSpeed === 1 ? 1.5 : 1);
            }}
            buttonType={SessionButtonType.Simple}
          />
        </StyledSpeedButton>,
      ]}
      customIcons={{
        play: <SessionIcon iconType="play" iconSize="small" />,
        pause: <SessionIcon iconType="pause" iconSize="small" />,
      }}
      dropShadow={selected}
    />
  );
};
