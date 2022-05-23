// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, useMemo, useEffect } from 'react';
import Measure from 'react-measure';
import { takeWhile, clamp, chunk, maxBy, flatten, noop } from 'lodash';
import type { VideoFrameSource } from 'ringrtc';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import {
  GroupCallOverflowArea,
  OVERFLOW_PARTICIPANT_WIDTH,
} from './GroupCallOverflowArea';
import type {
  GroupCallRemoteParticipantType,
  GroupCallVideoRequest,
} from '../types/Calling';
import { useGetCallingFrameBuffer } from '../calling/useGetCallingFrameBuffer';
import type { LocalizerType } from '../types/Util';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useDevicePixelRatio } from '../hooks/useDevicePixelRatio';
import { nonRenderedRemoteParticipant } from '../util/ringrtc/nonRenderedRemoteParticipant';
import { missingCaseError } from '../util/missingCaseError';
import { SECOND } from '../util/durations';
import { filter, join } from '../util/iterables';
import * as setUtil from '../util/setUtil';
import * as log from '../logging/log';
import { MAX_FRAME_HEIGHT, MAX_FRAME_WIDTH } from '../calling/constants';

const MIN_RENDERED_HEIGHT = 180;
const PARTICIPANT_MARGIN = 10;
const TIME_TO_STOP_REQUESTING_VIDEO_WHEN_PAGE_INVISIBLE = 20 * SECOND;

// We scale our video requests down for performance. This number is somewhat arbitrary.
const VIDEO_REQUEST_SCALAR = 0.75;

type Dimensions = {
  width: number;
  height: number;
};

type GridArrangement = {
  rows: Array<Array<GroupCallRemoteParticipantType>>;
  scalar: number;
};

type PropsType = {
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  isInSpeakerView: boolean;
  remoteParticipants: ReadonlyArray<GroupCallRemoteParticipantType>;
  setGroupCallVideoRequest: (_: Array<GroupCallVideoRequest>) => void;
  remoteAudioLevels: Map<number, number>;
};

enum VideoRequestMode {
  Normal = 'Normal',
  LowResolution = 'LowResolution',
  NoVideo = 'NoVideo',
}

// This component lays out group call remote participants. It uses a custom layout
//   algorithm (in other words, nothing that the browser provides, like flexbox) in
//   order to animate the boxes as they move around, and to figure out the right fits.
//
// It's worth looking at the UI (or a design of it) to get an idea of how it works. Some
//   things to notice:
//
// * Participants are arranged in 0 or more rows.
// * Each row is the same height, but each participant may have a different width.
// * It's possible, on small screens with lots of participants, to have participants
//   removed from the grid. This is because participants have a minimum rendered height.
//
// There should be more specific comments throughout, but the high-level steps are:
//
// 1. Figure out the maximum number of possible rows that could fit on the screen; this is
//    `maxRowCount`.
// 2. Split the participants into two groups: ones in the main grid and ones in the
//    overflow area. The grid should prioritize participants who have recently spoken.
// 3. For each possible number of rows (starting at 0 and ending at `maxRowCount`),
//    distribute participants across the rows at the minimum height. Then find the
//    "scalar": how much can we scale these boxes up while still fitting them on the
//    screen? The biggest scalar wins as the "best arrangement".
// 4. Lay out this arrangement on the screen.
export const GroupCallRemoteParticipants: React.FC<PropsType> = ({
  getGroupCallVideoFrameSource,
  i18n,
  isInSpeakerView,
  remoteParticipants,
  setGroupCallVideoRequest,
  remoteAudioLevels,
}) => {
  const [containerDimensions, setContainerDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });
  const [gridDimensions, setGridDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });

  const devicePixelRatio = useDevicePixelRatio();

  const getFrameBuffer = useGetCallingFrameBuffer();

  const { invisibleDemuxIds, onParticipantVisibilityChanged } =
    useInvisibleParticipants(remoteParticipants);

  // 1. Figure out the maximum number of possible rows that could fit on the screen.
  //
  // We choose the smaller of these two options:
  //
  // - The number of participants, which means there'd be one participant per row.
  // - The number of possible rows in the container, assuming all participants were
  //   rendered at minimum height. Doesn't rely on the number of participants—it's some
  //   simple division.
  //
  // Could be 0 if (a) there are no participants (b) the container's height is small.
  const maxRowCount = Math.min(
    remoteParticipants.length,
    Math.floor(
      containerDimensions.height / (MIN_RENDERED_HEIGHT + PARTICIPANT_MARGIN)
    )
  );

  // 2. Split participants into two groups: ones in the main grid and ones in the overflow
  //   sidebar.
  //
  // We start by sorting by `presenting` first since presenters should be on the main grid
  //   then we sort by `speakerTime` so that the most recent speakers are next in
  //   line for the main grid. Then we split the list in two: one for the grid and one for
  //   the overflow area.
  //
  // Once we've sorted participants into their respective groups, we sort them on
  //   something stable (the `demuxId`, but we could choose something else) so that people
  //   don't jump around within the group.
  //
  // These are primarily memoized for clarity, not performance.
  const sortedParticipants: Array<GroupCallRemoteParticipantType> = useMemo(
    () =>
      remoteParticipants
        .concat()
        .sort(
          (a, b) =>
            Number(b.presenting || 0) - Number(a.presenting || 0) ||
            (b.speakerTime || -Infinity) - (a.speakerTime || -Infinity)
        ),
    [remoteParticipants]
  );
  const gridParticipants: Array<GroupCallRemoteParticipantType> =
    useMemo(() => {
      if (!sortedParticipants.length) {
        return [];
      }

      const candidateParticipants = isInSpeakerView
        ? [sortedParticipants[0]]
        : sortedParticipants;

      // Imagine that we laid out all of the rows end-to-end. That's the maximum total
      //   width. So if there were 5 rows and the container was 100px wide, then we can't
      //   possibly fit more than 500px of participants.
      const maxTotalWidth = maxRowCount * containerDimensions.width;

      // We do the same thing for participants, "laying them out end-to-end" until they
      //   exceed the maximum total width.
      let totalWidth = 0;
      return takeWhile(candidateParticipants, remoteParticipant => {
        totalWidth += remoteParticipant.videoAspectRatio * MIN_RENDERED_HEIGHT;
        return totalWidth < maxTotalWidth;
      }).sort(stableParticipantComparator);
    }, [
      containerDimensions.width,
      isInSpeakerView,
      maxRowCount,
      sortedParticipants,
    ]);
  const overflowedParticipants: Array<GroupCallRemoteParticipantType> = useMemo(
    () =>
      sortedParticipants
        .slice(gridParticipants.length)
        .sort(stableParticipantComparator),
    [sortedParticipants, gridParticipants.length]
  );

  // 3. For each possible number of rows (starting at 0 and ending at `maxRowCount`),
  //   distribute participants across the rows at the minimum height. Then find the
  //   "scalar": how much can we scale these boxes up while still fitting them on the
  //   screen? The biggest scalar wins as the "best arrangement".
  const gridArrangement: GridArrangement = useMemo(() => {
    let bestArrangement: GridArrangement = {
      scalar: -1,
      rows: [],
    };

    if (!gridParticipants.length) {
      return bestArrangement;
    }

    for (let rowCount = 1; rowCount <= maxRowCount; rowCount += 1) {
      // We do something pretty naïve here and chunk the grid's participants into rows.
      //   For example, if there were 12 grid participants and `rowCount === 3`, there
      //   would be 4 participants per row.
      //
      // This naïve chunking is suboptimal in terms of absolute best fit, but it is much
      //   faster and simpler than trying to do this perfectly. In practice, this works
      //   fine in the UI from our testing.
      const numberOfParticipantsInRow = Math.ceil(
        gridParticipants.length / rowCount
      );
      const rows = chunk(gridParticipants, numberOfParticipantsInRow);

      // We need to find the scalar for this arrangement. Imagine that we have these
      //   participants at the minimum heights, and we want to scale everything up until
      //   it's about to overflow.
      //
      // We don't want it to overflow horizontally or vertically, so we calculate a
      //   "width scalar" and "height scalar" and choose the smaller of the two. (Choosing
      //   the LARGER of the two could cause overflow.)
      const widestRow = maxBy(rows, totalRemoteParticipantWidthAtMinHeight);
      if (!widestRow) {
        log.error('Unable to find the widest row, which should be impossible');
        continue;
      }
      const widthScalar =
        (gridDimensions.width - (widestRow.length + 1) * PARTICIPANT_MARGIN) /
        totalRemoteParticipantWidthAtMinHeight(widestRow);
      const heightScalar =
        (gridDimensions.height - (rowCount + 1) * PARTICIPANT_MARGIN) /
        (rowCount * MIN_RENDERED_HEIGHT);
      const scalar = Math.min(widthScalar, heightScalar);

      // If this scalar is the best one so far, we use that.
      if (scalar > bestArrangement.scalar) {
        bestArrangement = { scalar, rows };
      }
    }

    return bestArrangement;
  }, [
    gridParticipants,
    maxRowCount,
    gridDimensions.width,
    gridDimensions.height,
  ]);

  // 4. Lay out this arrangement on the screen.
  const gridParticipantHeight = Math.floor(
    gridArrangement.scalar * MIN_RENDERED_HEIGHT
  );
  const gridParticipantHeightWithMargin =
    gridParticipantHeight + PARTICIPANT_MARGIN;
  const gridTotalRowHeightWithMargin =
    gridParticipantHeightWithMargin * gridArrangement.rows.length;
  const gridTopOffset = Math.floor(
    (gridDimensions.height - gridTotalRowHeightWithMargin) / 2
  );

  const rowElements: Array<Array<JSX.Element>> = gridArrangement.rows.map(
    (remoteParticipantsInRow, index) => {
      const top = gridTopOffset + index * gridParticipantHeightWithMargin;

      const totalRowWidthWithoutMargins =
        totalRemoteParticipantWidthAtMinHeight(remoteParticipantsInRow) *
        gridArrangement.scalar;
      const totalRowWidth =
        totalRowWidthWithoutMargins +
        PARTICIPANT_MARGIN * (remoteParticipantsInRow.length - 1);
      const leftOffset = Math.floor((gridDimensions.width - totalRowWidth) / 2);

      let rowWidthSoFar = 0;
      return remoteParticipantsInRow.map(remoteParticipant => {
        const { demuxId, videoAspectRatio } = remoteParticipant;

        const audioLevel = remoteAudioLevels.get(demuxId) ?? 0;

        const renderedWidth = Math.floor(
          videoAspectRatio * gridParticipantHeight
        );
        const left = rowWidthSoFar + leftOffset;

        rowWidthSoFar += renderedWidth + PARTICIPANT_MARGIN;

        return (
          <GroupCallRemoteParticipant
            key={demuxId}
            getFrameBuffer={getFrameBuffer}
            getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
            height={gridParticipantHeight}
            i18n={i18n}
            audioLevel={audioLevel}
            left={left}
            remoteParticipant={remoteParticipant}
            top={top}
            width={renderedWidth}
          />
        );
      });
    }
  );

  const videoRequestMode = useVideoRequestMode();
  useEffect(() => {
    log.info(`Group call now using ${videoRequestMode} video request mode`);
  }, [videoRequestMode]);

  useEffect(() => {
    let videoRequest: Array<GroupCallVideoRequest>;

    switch (videoRequestMode) {
      case VideoRequestMode.Normal:
        videoRequest = [
          ...gridParticipants.map(participant => {
            let scalar: number;
            if (participant.sharingScreen) {
              // We want best-resolution video if someone is sharing their screen.
              scalar = Math.max(devicePixelRatio, 1);
            } else {
              scalar = VIDEO_REQUEST_SCALAR;
            }
            return {
              demuxId: participant.demuxId,
              width: clamp(
                Math.floor(
                  gridParticipantHeight * participant.videoAspectRatio * scalar
                ),
                1,
                MAX_FRAME_WIDTH
              ),
              height: clamp(
                Math.floor(gridParticipantHeight * scalar),
                1,
                MAX_FRAME_HEIGHT
              ),
            };
          }),
          ...overflowedParticipants.map(participant => {
            if (invisibleDemuxIds.has(participant.demuxId)) {
              return nonRenderedRemoteParticipant(participant);
            }

            return {
              demuxId: participant.demuxId,
              width: clamp(
                Math.floor(OVERFLOW_PARTICIPANT_WIDTH * VIDEO_REQUEST_SCALAR),
                1,
                MAX_FRAME_WIDTH
              ),
              height: clamp(
                Math.floor(
                  (OVERFLOW_PARTICIPANT_WIDTH / participant.videoAspectRatio) *
                    VIDEO_REQUEST_SCALAR
                ),
                1,
                MAX_FRAME_HEIGHT
              ),
            };
          }),
        ];
        break;
      case VideoRequestMode.LowResolution:
        videoRequest = remoteParticipants.map(participant =>
          participant.hasRemoteVideo
            ? {
                demuxId: participant.demuxId,
                width: 1,
                height: 1,
              }
            : nonRenderedRemoteParticipant(participant)
        );
        break;
      case VideoRequestMode.NoVideo:
        videoRequest = remoteParticipants.map(nonRenderedRemoteParticipant);
        break;
      default:
        log.error(missingCaseError(videoRequestMode));
        videoRequest = remoteParticipants.map(nonRenderedRemoteParticipant);
        break;
    }

    setGroupCallVideoRequest(videoRequest);
  }, [
    devicePixelRatio,
    gridParticipantHeight,
    gridParticipants,
    invisibleDemuxIds,
    overflowedParticipants,
    remoteParticipants,
    setGroupCallVideoRequest,
    videoRequestMode,
  ]);

  return (
    <Measure
      bounds
      onResize={({ bounds }) => {
        if (!bounds) {
          log.error('We should be measuring the bounds');
          return;
        }
        setContainerDimensions(bounds);
      }}
    >
      {containerMeasure => (
        <div
          className="module-ongoing-call__participants"
          ref={containerMeasure.measureRef}
        >
          <Measure
            bounds
            onResize={({ bounds }) => {
              if (!bounds) {
                log.error('We should be measuring the bounds');
                return;
              }
              setGridDimensions(bounds);
            }}
          >
            {gridMeasure => (
              <div
                className="module-ongoing-call__participants__grid"
                ref={gridMeasure.measureRef}
              >
                {flatten(rowElements)}
              </div>
            )}
          </Measure>

          <GroupCallOverflowArea
            getFrameBuffer={getFrameBuffer}
            getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
            i18n={i18n}
            onParticipantVisibilityChanged={onParticipantVisibilityChanged}
            overflowedParticipants={overflowedParticipants}
            remoteAudioLevels={remoteAudioLevels}
          />
        </div>
      )}
    </Measure>
  );
};

// This function is only meant for use with `useInvisibleParticipants`. It helps avoid
//   returning new set instances when the underlying values are equal.
function pickDifferentSet<T>(a: Readonly<Set<T>>, b: Readonly<Set<T>>): Set<T> {
  return a.size === b.size ? a : b;
}

function useInvisibleParticipants(
  remoteParticipants: ReadonlyArray<GroupCallRemoteParticipantType>
): Readonly<{
  invisibleDemuxIds: Set<number>;
  onParticipantVisibilityChanged: (demuxId: number, isVisible: boolean) => void;
}> {
  const [invisibleDemuxIds, setInvisibleDemuxIds] = useState(new Set<number>());

  const onParticipantVisibilityChanged = useCallback(
    (demuxId: number, isVisible: boolean) => {
      setInvisibleDemuxIds(oldInvisibleDemuxIds => {
        const toggled = setUtil.toggle(
          oldInvisibleDemuxIds,
          demuxId,
          !isVisible
        );
        return pickDifferentSet(oldInvisibleDemuxIds, toggled);
      });
    },
    []
  );

  useEffect(() => {
    log.info(
      `Invisible demux IDs changed to [${join(invisibleDemuxIds, ',')}]`
    );
  }, [invisibleDemuxIds]);

  useEffect(() => {
    const remoteParticipantDemuxIds = new Set<number>(
      remoteParticipants.map(r => r.demuxId)
    );
    setInvisibleDemuxIds(oldInvisibleDemuxIds => {
      const staleIds = filter(
        oldInvisibleDemuxIds,
        id => !remoteParticipantDemuxIds.has(id)
      );
      const withoutStaleIds = setUtil.remove(oldInvisibleDemuxIds, ...staleIds);
      return pickDifferentSet(oldInvisibleDemuxIds, withoutStaleIds);
    });
  }, [remoteParticipants]);

  return {
    invisibleDemuxIds,
    onParticipantVisibilityChanged,
  };
}

function useVideoRequestMode(): VideoRequestMode {
  const isPageVisible = usePageVisibility();

  const [result, setResult] = useState<VideoRequestMode>(
    isPageVisible ? VideoRequestMode.Normal : VideoRequestMode.LowResolution
  );

  useEffect(() => {
    if (isPageVisible) {
      setResult(VideoRequestMode.Normal);
      return noop;
    }

    setResult(VideoRequestMode.LowResolution);

    const timeout = setTimeout(() => {
      setResult(VideoRequestMode.NoVideo);
    }, TIME_TO_STOP_REQUESTING_VIDEO_WHEN_PAGE_INVISIBLE);

    return () => {
      clearTimeout(timeout);
    };
  }, [isPageVisible]);

  return result;
}

function totalRemoteParticipantWidthAtMinHeight(
  remoteParticipants: ReadonlyArray<GroupCallRemoteParticipantType>
): number {
  return remoteParticipants.reduce(
    (result, { videoAspectRatio }) =>
      result + videoAspectRatio * MIN_RENDERED_HEIGHT,
    0
  );
}

function stableParticipantComparator(
  a: Readonly<{ demuxId: number }>,
  b: Readonly<{ demuxId: number }>
): number {
  return a.demuxId - b.demuxId;
}
