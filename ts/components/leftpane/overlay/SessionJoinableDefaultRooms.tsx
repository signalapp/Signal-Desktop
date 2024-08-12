import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import styled from 'styled-components';
import { parseOpenGroupV2 } from '../../../session/apis/open_group_api/opengroupV2/JoinOpenGroupV2';
import { sogsV3FetchPreviewBase64 } from '../../../session/apis/open_group_api/sogsv3/sogsV3FetchFile';
import { DefaultRoomsState, updateDefaultBase64RoomData } from '../../../state/ducks/defaultRooms';
import { StateType } from '../../../state/reducer';
import { useHTMLDirection } from '../../../util/i18n';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { H4 } from '../../basic/Heading';
import { PillContainerHoverable, StyledPillContainerHoverable } from '../../basic/PillContainer';
import { SpacerXS } from '../../basic/Text';
import { SessionSpinner } from '../../loading';

export type JoinableRoomProps = {
  completeUrl: string;
  name: string;
  roomId: string;
  imageId?: string;
  onClick?: (completeUrl: string) => void;
  base64Data?: string;
};

const SessionJoinableRoomAvatar = (props: JoinableRoomProps) => {
  const dispatch = useDispatch();

  useEffect(() => {
    let isCancelled = false;

    try {
      const parsedInfos = parseOpenGroupV2(props.completeUrl);
      const imageID = props.imageId;
      if (parsedInfos) {
        if (props.base64Data) {
          return;
        }
        if (isCancelled) {
          return;
        }
        // eslint-disable-next-line more/no-then
        sogsV3FetchPreviewBase64({ ...parsedInfos, imageID })
          .then(base64 => {
            if (isCancelled) {
              return;
            }
            const payload = {
              roomId: props.roomId,
              base64Data: base64 || '',
            };
            dispatch(updateDefaultBase64RoomData(payload));
          })
          .catch(e => {
            if (isCancelled) {
              return;
            }
            window?.log?.warn('sogsV3FetchPreview failed', e);
            const payload = {
              roomId: props.roomId,
              base64Data: '',
            };
            dispatch(updateDefaultBase64RoomData(payload));
          });
      }
    } catch (e) {
      window?.log?.warn(e.message);
    }
    // eslint-disable-next-line consistent-return
    return () => {
      isCancelled = true;
    };
  }, [props.imageId, props.completeUrl, dispatch, props.base64Data, props.roomId]);

  return (
    <Avatar
      size={AvatarSize.XS}
      base64Data={props.base64Data}
      {...props}
      pubkey=""
      onAvatarClick={() => props.onClick?.(props.completeUrl)}
    />
  );
};

const StyledRoomName = styled(Flex)`
  font-size: var(--font-size-md);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin: 0 var(--margins-sm);
`;

const SessionJoinableRoomName = (props: JoinableRoomProps) => {
  return <StyledRoomName>{props.name}</StyledRoomName>;
};

const SessionJoinableRoomRow = (props: JoinableRoomProps) => {
  const { onClick, completeUrl } = props;
  const onClickWithUrl = onClick
    ? () => {
        onClick?.(completeUrl);
      }
    : undefined;

  return (
    <StyledPillContainerHoverable container={true} alignItems="center" flexShrink={0} width={'70%'}>
      <PillContainerHoverable
        onClick={onClickWithUrl}
        margin={'var(--margins-sm)'}
        padding="var(--margins-xs) var(--margins-sm)"
      >
        <SessionJoinableRoomAvatar {...props} />
        <SessionJoinableRoomName {...props} />
      </PillContainerHoverable>
    </StyledPillContainerHoverable>
  );
};

const JoinableRooms = (props: {
  joinableRooms: DefaultRoomsState;
  alreadyJoining: boolean;
  onJoinClick?: (completeUrl: string) => void;
}) => {
  return (
    <>
      {props.joinableRooms.rooms.map(r => {
        return (
          <SessionJoinableRoomRow
            key={r.id}
            completeUrl={r.completeUrl}
            name={r.name}
            roomId={r.id}
            imageId={r.imageId}
            base64Data={r.base64Data}
            onClick={props.onJoinClick}
          />
        );
      })}
    </>
  );
};

export const SessionJoinableRooms = (props: {
  onJoinClick?: (completeUrl: string) => void;
  alreadyJoining: boolean;
}) => {
  const htmlDirection = useHTMLDirection();
  const joinableRooms = useSelector((state: StateType) => state.defaultRooms);

  if (!joinableRooms.inProgress && !joinableRooms.rooms?.length) {
    window?.log?.info('no default joinable rooms yet and not in progress');
    return null;
  }

  // There is a spinner in the overlay, so we don't need to show it when joining
  if (props.alreadyJoining) {
    return null;
  }

  return (
    <Flex
      container={true}
      flexGrow={1}
      flexDirection="column"
      alignItems="center"
      dir={htmlDirection}
      width="100%"
    >
      <H4>{window.i18n('orJoinOneOfThese')}</H4>
      <SpacerXS />
      <Flex
        container={true}
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        flexGrow={0}
        flexWrap="wrap"
        dir={htmlDirection}
        width={'100%'}
        margin={'0 0 0 calc(var(--margins-md) * -1)'}
      >
        {joinableRooms.inProgress ? (
          <SessionSpinner loading={true} />
        ) : (
          <JoinableRooms
            joinableRooms={joinableRooms}
            alreadyJoining={props.alreadyJoining}
            onJoinClick={props.onJoinClick}
          />
        )}
      </Flex>
    </Flex>
  );
};
