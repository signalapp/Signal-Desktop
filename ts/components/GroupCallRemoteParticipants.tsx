// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useMemo } from 'react';
import Measure from 'react-measure';
import { takeWhile, chunk, maxBy, flatten } from 'lodash';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import {
  GroupCallRemoteParticipantType,
  VideoFrameSource,
} from '../types/Calling';
import { LocalizerType } from '../types/Util';

const MIN_RENDERED_HEIGHT = 10;
const PARTICIPANT_MARGIN = 10;

interface Dimensions {
  width: number;
  height: number;
}

interface GridArrangement {
  rows: Array<Array<GroupCallRemoteParticipantType>>;
  scalar: number;
}

interface PropsType {
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  remoteParticipants: ReadonlyArray<GroupCallRemoteParticipantType>;
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
// 2. Figure out how many participants should be visible if all participants were rendered
//    at the minimum height. Most of the time, we'll be able to render all of them, but on
//    full calls with lots of participants, there could be some lost.
// 3. For each possible number of rows (starting at 0 and ending at `maxRowCount`),
//    distribute participants across the rows at the minimum height. Then find the
//    "scalar": how much can we scale these boxes up while still fitting them on the
//    screen? The biggest scalar wins as the "best arrangement".
// 4. Lay out this arrangement on the screen.
export const GroupCallRemoteParticipants: React.FC<PropsType> = ({
  getGroupCallVideoFrameSource,
  i18n,
  remoteParticipants,
}) => {
  const [containerDimensions, setContainerDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });

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

  // 2. Figure out how many participants should be visible if all participants were
  //   rendered at the minimum height. Most of the time, we'll be able to render all of
  //   them, but on full calls with lots of participants, there could be some lost.
  //
  // This is primarily memoized for clarity, not performance. We only need the result,
  //   not any of the "intermediate" values.
  const visibleParticipants: Array<GroupCallRemoteParticipantType> = useMemo(() => {
    // Imagine that we laid out all of the rows end-to-end. That's the maximum total
    //   width. So if there were 5 rows and the container was 100px wide, then we can't
    //   possibly fit more than 500px of participants.
    const maxTotalWidth = maxRowCount * containerDimensions.width;

    // We do the same thing for participants, "laying them out end-to-end" until they
    //   exceed the maximum total width.
    let totalWidth = 0;
    return takeWhile(remoteParticipants, remoteParticipant => {
      totalWidth += remoteParticipant.videoAspectRatio * MIN_RENDERED_HEIGHT;
      return totalWidth < maxTotalWidth;
    });
  }, [maxRowCount, containerDimensions.width, remoteParticipants]);

  // 3. For each possible number of rows (starting at 0 and ending at `maxRowCount`),
  //   distribute participants across the rows at the minimum height. Then find the
  //   "scalar": how much can we scale these boxes up while still fitting them on the
  //   screen? The biggest scalar wins as the "best arrangement".
  const gridArrangement: GridArrangement = useMemo(() => {
    let bestArrangement: GridArrangement = {
      scalar: -1,
      rows: [],
    };

    if (!visibleParticipants.length) {
      return bestArrangement;
    }

    for (let rowCount = 1; rowCount <= maxRowCount; rowCount += 1) {
      // We do something pretty naïve here and chunk the visible participants into rows.
      //   For example, if there were 12 visible participants and `rowCount === 3`, there
      //   would be 4 participants per row.
      //
      // This naïve chunking is suboptimal in terms of absolute best fit, but it is much
      //   faster and simpler than trying to do this perfectly. In practice, this works
      //   fine in the UI from our testing.
      const numberOfParticipantsInRow = Math.ceil(
        visibleParticipants.length / rowCount
      );
      const rows = chunk(visibleParticipants, numberOfParticipantsInRow);

      // We need to find the scalar for this arrangement. Imagine that we have these
      //   participants at the minimum heights, and we want to scale everything up until
      //   it's about to overflow.
      //
      // We don't want it to overflow horizontally or vertically, so we calculate a
      //   "width scalar" and "height scalar" and choose the smaller of the two. (Choosing
      //   the LARGER of the two could cause overflow.)
      const widestRow = maxBy(rows, totalRemoteParticipantWidthAtMinHeight);
      if (!widestRow) {
        window.log.error(
          'Unable to find the widest row, which should be impossible'
        );
        continue;
      }
      const widthScalar =
        (containerDimensions.width -
          (widestRow.length + 1) * PARTICIPANT_MARGIN) /
        totalRemoteParticipantWidthAtMinHeight(widestRow);
      const heightScalar =
        (containerDimensions.height - (rowCount + 1) * PARTICIPANT_MARGIN) /
        (rowCount * MIN_RENDERED_HEIGHT);
      const scalar = Math.min(widthScalar, heightScalar);

      // If this scalar is the best one so far, we use that.
      if (scalar > bestArrangement.scalar) {
        bestArrangement = { scalar, rows };
      }
    }

    return bestArrangement;
  }, [
    visibleParticipants,
    maxRowCount,
    containerDimensions.width,
    containerDimensions.height,
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
    (containerDimensions.height - gridTotalRowHeightWithMargin) / 2
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
      const leftOffset = Math.floor(
        (containerDimensions.width - totalRowWidth) / 2
      );

      let rowWidthSoFar = 0;
      return remoteParticipantsInRow.map(remoteParticipant => {
        const renderedWidth = Math.floor(
          remoteParticipant.videoAspectRatio * gridParticipantHeight
        );
        const left = rowWidthSoFar + leftOffset;

        rowWidthSoFar += renderedWidth + PARTICIPANT_MARGIN;

        return (
          <GroupCallRemoteParticipant
            key={remoteParticipant.demuxId}
            getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
            height={gridParticipantHeight}
            i18n={i18n}
            left={left}
            remoteParticipant={remoteParticipant}
            top={top}
            width={renderedWidth}
          />
        );
      });
    }
  );
  const remoteParticipantElements = flatten(rowElements);

  return (
    <Measure
      bounds
      onResize={({ bounds }) => {
        if (!bounds) {
          window.log.error('We should be measuring the bounds');
          return;
        }
        setContainerDimensions(bounds);
      }}
    >
      {({ measureRef }) => (
        <div className="module-ongoing-call__grid" ref={measureRef}>
          {remoteParticipantElements}
        </div>
      )}
    </Measure>
  );
};

function totalRemoteParticipantWidthAtMinHeight(
  remoteParticipants: ReadonlyArray<GroupCallRemoteParticipantType>
): number {
  return remoteParticipants.reduce(
    (result, { videoAspectRatio }) =>
      result + videoAspectRatio * MIN_RENDERED_HEIGHT,
    0
  );
}
