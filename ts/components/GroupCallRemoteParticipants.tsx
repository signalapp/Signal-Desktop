// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { clamp, chunk, maxBy, flatten, noop } from 'lodash';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import {
  GroupCallOverflowArea,
  OVERFLOW_PARTICIPANT_WIDTH,
} from './GroupCallOverflowArea';
import type {
  GroupCallRemoteParticipantType,
  GroupCallVideoRequest,
} from '../types/Calling';
import { CallViewMode } from '../types/Calling';
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
import { SizeObserver } from '../hooks/useSizeObserver';
import { strictAssert } from '../util/assert';
import type { CallingImageDataCache } from './CallManager';

const SMALL_TILES_MIN_HEIGHT = 80;
const LARGE_TILES_MIN_HEIGHT = 200;
const PARTICIPANT_MARGIN = 12;
const TIME_TO_STOP_REQUESTING_VIDEO_WHEN_PAGE_INVISIBLE = 20 * SECOND;
const PAGINATION_BUTTON_ASPECT_RATIO = 1;
const MAX_PARTICIPANTS_PER_PAGE = 49; // 49 remote + 1 self-video = 50 total
// We scale our video requests down for performance. This number is somewhat arbitrary.
const VIDEO_REQUEST_SCALAR = 0.75;

type Dimensions = {
  width: number;
  height: number;
};

type GridArrangement = {
  rows: Array<Array<ParticipantTileType>>;
  scalar: number;
};
type PaginationButtonType = {
  isPaginationButton: true;
  videoAspectRatio: number;
  paginationButtonType: 'prev' | 'next';
  numParticipants: number;
};
type ParticipantTileType =
  | GroupCallRemoteParticipantType
  | PaginationButtonType;

type PropsType = {
  callViewMode: CallViewMode;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  imageDataCache: React.RefObject<CallingImageDataCache>;
  isCallReconnecting: boolean;
  joinedAt: number | null;
  remoteParticipants: ReadonlyArray<GroupCallRemoteParticipantType>;
  setGroupCallVideoRequest: (
    _: Array<GroupCallVideoRequest>,
    speakerHeight: number
  ) => void;
  remoteAudioLevels: Map<number, number>;
  onClickRaisedHand?: () => void;
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
//   removed from the grid, or on subsequent pages. This is because participants
//   have a minimum rendered height.
// * Participant videos may have different aspect ratios
// * We want to ensure that presenters and recent speakers are shown on the first page,
//   but we also want to minimize tiles jumping around as much as possible.
//
// There should be more specific comments throughout, but the high-level steps are:
//
// 1. Figure out the maximum number of possible rows that could fit on a page; this is
//    `maxRowsPerPage`.
// 2. Sort the participants in priority order: we want to fit presenters and recent
//    speakers in the grid first
// 3. Figure out which participants should go on each page -- for non-paginated views,
//    this is just one page, but for paginated views, we could have many pages. The
//    general idea here is to fill up each page row-by-row, with each video as small
//    as we allow.
// 4. Try to distribute the videos throughout the grid to find the largest "scalar":
//    how much can we scale these boxes up while still fitting them on the screen?
//    The biggest scalar wins as the "best arrangement".
// 5. Lay out this arrangement on the screen.

export function GroupCallRemoteParticipants({
  callViewMode,
  getGroupCallVideoFrameSource,
  imageDataCache,
  i18n,
  isCallReconnecting,
  joinedAt,
  remoteParticipants,
  setGroupCallVideoRequest,
  remoteAudioLevels,
  onClickRaisedHand,
}: PropsType): JSX.Element {
  const [gridDimensions, setGridDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });

  const [pageIndex, setPageIndex] = useState(0);

  const devicePixelRatio = useDevicePixelRatio();

  const getFrameBuffer = useGetCallingFrameBuffer();

  const { invisibleDemuxIds, onParticipantVisibilityChanged } =
    useInvisibleParticipants(remoteParticipants);

  const minRenderedHeight =
    callViewMode === CallViewMode.Paginated
      ? SMALL_TILES_MIN_HEIGHT
      : LARGE_TILES_MIN_HEIGHT;

  const isInSpeakerView =
    callViewMode === CallViewMode.Speaker ||
    callViewMode === CallViewMode.Presentation;

  const isInPaginationView = callViewMode === CallViewMode.Paginated;
  const shouldShowOverflow = !isInPaginationView;

  const maxRowWidth = gridDimensions.width;
  const maxGridHeight = gridDimensions.height;

  // 1. Figure out the maximum number of possible rows that could fit on the page.
  //    Could be 0 if (a) there are no participants (b) the container's height is small.
  const maxRowsPerPage = Math.floor(
    maxGridHeight / (minRenderedHeight + PARTICIPANT_MARGIN)
  );

  // 2. Sort the participants in priority order:  by `presenting` first, since presenters
  //   should be on the main grid, then by `speakerTime` so that the most recent speakers
  //   are next in line for the first pages of the grid
  const prioritySortedParticipants: Array<GroupCallRemoteParticipantType> =
    useMemo(
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

  // 3. Layout the participants on each page. The general algorithm is: first, try to fill
  //   up each page with as many participants as possible at the smallest acceptable video
  //   height. Second, sort the participants that fit on each page by a stable sort order,
  //   and make sure they still fit on the page! Third, add tiles at the beginning and end
  //   of each page (if paginated) to act as back and next buttons.
  const gridParticipantsByPage: Array<ParticipantsInPageType> = useMemo(() => {
    if (!prioritySortedParticipants.length) {
      return [];
    }

    if (!maxRowsPerPage) {
      return [];
    }

    if (isInSpeakerView) {
      return [
        {
          rows: [[prioritySortedParticipants[0]]],
          hasSpaceRemaining: false,
          numParticipants: 1,
        },
      ];
    }

    return getGridParticipantsByPage({
      participants: prioritySortedParticipants,
      maxRowWidth,
      maxPages: isInPaginationView ? Infinity : 1,
      maxRowsPerPage,
      minRenderedHeight,
      maxParticipantsPerPage: MAX_PARTICIPANTS_PER_PAGE,
      currentPage: pageIndex,
    });
  }, [
    maxRowWidth,
    isInPaginationView,
    isInSpeakerView,
    maxRowsPerPage,
    minRenderedHeight,
    pageIndex,
    prioritySortedParticipants,
  ]);

  // Make sure we're not on a page that no longer exists (e.g. if people left the call)
  if (
    pageIndex >= gridParticipantsByPage.length &&
    gridParticipantsByPage.length > 0
  ) {
    setPageIndex(gridParticipantsByPage.length - 1);
  }

  const totalParticipantsInGrid = gridParticipantsByPage.reduce(
    (pageCount, { numParticipants }) => pageCount + numParticipants,
    0
  );

  // In speaker or sidebar views, not all participants will be on the grid; they'll
  //   get put in the overflow zone.
  const overflowedParticipants: Array<GroupCallRemoteParticipantType> = useMemo(
    () =>
      isInPaginationView
        ? []
        : prioritySortedParticipants
            .slice(totalParticipantsInGrid)
            .sort(stableParticipantComparator),
    [isInPaginationView, prioritySortedParticipants, totalParticipantsInGrid]
  );

  const participantsOnOtherPages = useMemo(
    () =>
      gridParticipantsByPage
        .map((page, index) => {
          if (index === pageIndex) {
            return [];
          }
          return page.rows.flat();
        })
        .flat()
        .filter(isGroupCallRemoteParticipant),
    [gridParticipantsByPage, pageIndex]
  );

  const currentPage = gridParticipantsByPage.at(pageIndex) ?? {
    rows: [],
  };

  // 4. Try to arrange the current page such that we can scale the videos up
  //   as much as possible.
  const gridArrangement = arrangeParticipantsInGrid({
    participantsInRows: currentPage.rows,
    maxRowsPerPage,
    maxRowWidth,
    maxGridHeight,
    minRenderedHeight,
  });

  const nextPage = () => {
    setPageIndex(index => index + 1);
  };

  const prevPage = () => {
    setPageIndex(index => Math.max(0, index - 1));
  };

  // 5. Lay out the current page on the screen.
  const gridParticipantHeight = Math.round(
    gridArrangement.scalar * minRenderedHeight
  );
  const gridParticipantHeightWithMargin =
    gridParticipantHeight + PARTICIPANT_MARGIN;
  const gridTotalRowHeightWithMargin =
    gridParticipantHeightWithMargin * gridArrangement.rows.length -
    PARTICIPANT_MARGIN;
  const gridTopOffset = Math.max(
    0,
    Math.round((gridDimensions.height - gridTotalRowHeightWithMargin) / 2)
  );

  const rowElements: Array<Array<JSX.Element>> = gridArrangement.rows.map(
    (tiles, index) => {
      const top = gridTopOffset + index * gridParticipantHeightWithMargin;

      const totalRowWidthWithoutMargins =
        totalRowWidthAtHeight(tiles, minRenderedHeight) *
        gridArrangement.scalar;
      const totalRowWidth =
        totalRowWidthWithoutMargins + PARTICIPANT_MARGIN * (tiles.length - 1);
      const leftOffset = Math.max(
        0,
        Math.round((gridDimensions.width - totalRowWidth) / 2)
      );

      let rowWidthSoFar = 0;
      return tiles.map(tile => {
        const left = rowWidthSoFar + leftOffset;

        const renderedWidth = Math.round(
          tile.videoAspectRatio * gridParticipantHeight
        );

        rowWidthSoFar += renderedWidth + PARTICIPANT_MARGIN;

        if (isPaginationButton(tile)) {
          const isNextButton = tile.paginationButtonType === 'next';
          const isPrevButton = tile.paginationButtonType === 'prev';
          return (
            <button
              key={
                isNextButton ? 'next-pagination-tile' : 'prev-pagination-tile'
              }
              onClick={isNextButton ? nextPage : prevPage}
              style={{
                insetInlineStart: left,
                insetBlockStart: top,
                width: renderedWidth,
                height: gridParticipantHeight,
              }}
              type="button"
              className="module-ongoing-call__group-call--pagination-tile"
            >
              {isPrevButton ? (
                <div className="module-ongoing-call__group-call--pagination-tile--prev-arrow" />
              ) : null}
              +{tile.numParticipants}
              {isNextButton ? (
                <div className="module-ongoing-call__group-call--pagination-tile--next-arrow" />
              ) : null}
            </button>
          );
        }

        return (
          <GroupCallRemoteParticipant
            key={tile.demuxId}
            getFrameBuffer={getFrameBuffer}
            imageDataCache={imageDataCache}
            getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
            onClickRaisedHand={onClickRaisedHand}
            height={gridParticipantHeight}
            i18n={i18n}
            audioLevel={remoteAudioLevels.get(tile.demuxId) ?? 0}
            left={left}
            remoteParticipant={tile}
            top={top}
            width={renderedWidth}
            remoteParticipantsCount={remoteParticipants.length}
            isActiveSpeakerInSpeakerView={isInSpeakerView}
            isCallReconnecting={isCallReconnecting}
            joinedAt={joinedAt}
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
          ...currentPage.rows
            .flat()
            // Filter out any next/previous page buttons
            .filter(isGroupCallRemoteParticipant)
            .map(participant => {
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
                  Math.round(
                    gridParticipantHeight *
                      participant.videoAspectRatio *
                      scalar
                  ),
                  1,
                  MAX_FRAME_WIDTH
                ),
                height: clamp(
                  Math.round(gridParticipantHeight * scalar),
                  1,
                  MAX_FRAME_HEIGHT
                ),
              };
            }),
          ...participantsOnOtherPages.map(nonRenderedRemoteParticipant),
          ...overflowedParticipants.map(participant => {
            if (invisibleDemuxIds.has(participant.demuxId)) {
              return nonRenderedRemoteParticipant(participant);
            }

            return {
              demuxId: participant.demuxId,
              width: clamp(
                Math.round(OVERFLOW_PARTICIPANT_WIDTH * VIDEO_REQUEST_SCALAR),
                1,
                MAX_FRAME_WIDTH
              ),
              height: clamp(
                Math.round(
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
    setGroupCallVideoRequest(
      videoRequest,
      clamp(gridParticipantHeight, 0, MAX_FRAME_HEIGHT)
    );
  }, [
    devicePixelRatio,
    currentPage.rows,
    gridParticipantHeight,
    invisibleDemuxIds,
    overflowedParticipants,
    remoteParticipants,
    setGroupCallVideoRequest,
    videoRequestMode,
    participantsOnOtherPages,
  ]);

  return (
    <div className="module-ongoing-call__participants">
      <div className="module-ongoing-call__participants__grid--wrapper">
        <SizeObserver
          onSizeChange={size => {
            setGridDimensions(size);
          }}
        >
          {gridRef => (
            <div
              className="module-ongoing-call__participants__grid"
              ref={gridRef}
            >
              {flatten(rowElements)}

              {isInPaginationView && (
                <>
                  {pageIndex > 0 ? (
                    <button
                      aria-label="Prev"
                      className="module-ongoing-call__prev-page"
                      onClick={prevPage}
                      type="button"
                    >
                      <div className="module-ongoing-call__prev-page--arrow" />
                    </button>
                  ) : null}
                  {pageIndex < gridParticipantsByPage.length - 1 ? (
                    <button
                      aria-label="Next"
                      className="module-ongoing-call__next-page"
                      onClick={nextPage}
                      type="button"
                    >
                      <div className="module-ongoing-call__next-page--arrow" />
                    </button>
                  ) : null}
                </>
              )}
            </div>
          )}
        </SizeObserver>
      </div>

      {shouldShowOverflow && overflowedParticipants.length > 0 ? (
        <GroupCallOverflowArea
          getFrameBuffer={getFrameBuffer}
          getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
          imageDataCache={imageDataCache}
          i18n={i18n}
          isCallReconnecting={isCallReconnecting}
          joinedAt={joinedAt}
          onClickRaisedHand={onClickRaisedHand}
          onParticipantVisibilityChanged={onParticipantVisibilityChanged}
          overflowedParticipants={overflowedParticipants}
          remoteAudioLevels={remoteAudioLevels}
          remoteParticipantsCount={remoteParticipants.length}
        />
      ) : null}
    </div>
  );
}

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

function totalRowWidthAtHeight(
  participantsInRow: ReadonlyArray<
    Pick<ParticipantTileType, 'videoAspectRatio'>
  >,
  height: number
): number {
  return participantsInRow.reduce(
    (result, participant) =>
      result + participantWidthAtHeight(participant, height),
    0
  );
}

function participantWidthAtHeight(
  participant: Pick<ParticipantTileType, 'videoAspectRatio'>,
  height: number
) {
  return participant.videoAspectRatio * height;
}

function stableParticipantComparator(
  a: Readonly<{ demuxId: number }>,
  b: Readonly<{ demuxId: number }>
): number {
  return a.demuxId - b.demuxId;
}

type ParticipantsInPageType<
  T extends { videoAspectRatio: number } = ParticipantTileType,
> = {
  rows: Array<Array<T>>;
  numParticipants: number;
};

type PageLayoutPropsType = {
  maxRowWidth: number;
  minRenderedHeight: number;
  maxRowsPerPage: number;
  maxParticipantsPerPage: number;
};
function getGridParticipantsByPage({
  participants,
  maxPages,
  currentPage,
  ...pageLayoutProps
}: PageLayoutPropsType & {
  participants: Array<GroupCallRemoteParticipantType>;
  maxPages: number;
  currentPage?: number;
}): Array<ParticipantsInPageType> {
  if (!participants.length) {
    return [];
  }

  const pages: Array<ParticipantsInPageType> = [];

  function getTotalParticipantsOnGrid() {
    return pages.reduce((count, page) => count + page.numParticipants, 0);
  }

  let remainingParticipants = [...participants];
  while (remainingParticipants.length) {
    if (currentPage === pages.length - 1) {
      // Optimization: we can stop early, we don't have to lay out the remainder of the
      //   pages
      pages.push({
        rows: [remainingParticipants],
        numParticipants: remainingParticipants.length,
      });
      return pages;
    }

    const nextPageInPriorityOrder = getNextPage({
      participants: remainingParticipants,
      leaveRoomForPrevPageButton: pages.length > 0,
      leaveRoomForNextPageButton: pages.length + 1 < maxPages,
      ...pageLayoutProps,
    });

    // We got the next page, but it's in priority order; let's see if these participants
    //   also fit in sorted order
    const priorityParticipantsOnNextPage = nextPageInPriorityOrder.rows.flat();
    let sortedParticipantsHopingToFitOnPage = [
      ...priorityParticipantsOnNextPage,
    ].sort(stableParticipantComparator);
    let nextPageInSortedOrder = getNextPage({
      participants: sortedParticipantsHopingToFitOnPage,
      leaveRoomForPrevPageButton: pages.length > 0,
      leaveRoomForNextPageButton: pages.length + 1 < maxPages,
      isSubsetOfAllParticipants:
        sortedParticipantsHopingToFitOnPage.length <
        remainingParticipants.length,
      ...pageLayoutProps,
    });

    let nextPage: ParticipantsInPageType<ParticipantTileType> | undefined;

    if (
      nextPageInSortedOrder.numParticipants ===
      nextPageInPriorityOrder.numParticipants
    ) {
      // Great, we're able to show everyone. It's possible that there is now extra space
      //   and we could show more people, but let's leave it here for simplicity
      nextPage = nextPageInSortedOrder;
    } else {
      // We weren't able to fit everyone. Let's remove the least-prioritized person and
      //   try again. It's pretty unlikely this will take more than 1 attempt, but
      //   let's take more and more participants off the screen if it takes a lot of
      //   attempts so we don't have to iterate dozens of times.
      const PARTICIPANTS_TO_REMOVE_PER_ATTEMPT = [1, 1, 1, 2, 5];
      const MAX_ATTEMPTS = 5;
      let attemptNumber = 0;

      while (
        sortedParticipantsHopingToFitOnPage.length &&
        attemptNumber < MAX_ATTEMPTS
      ) {
        const numLeastPrioritizedParticipantsToRemove =
          PARTICIPANTS_TO_REMOVE_PER_ATTEMPT[
            Math.min(
              attemptNumber,
              PARTICIPANTS_TO_REMOVE_PER_ATTEMPT.length - 1
            )
          ];

        const leastPrioritizedParticipantIds = new Set(
          priorityParticipantsOnNextPage
            .splice(
              -1 * numLeastPrioritizedParticipantsToRemove,
              numLeastPrioritizedParticipantsToRemove
            )
            .map(participant => participant.demuxId)
        );

        sortedParticipantsHopingToFitOnPage =
          sortedParticipantsHopingToFitOnPage.filter(
            participant =>
              !leastPrioritizedParticipantIds.has(participant.demuxId)
          );

        nextPageInSortedOrder = getNextPage({
          participants: sortedParticipantsHopingToFitOnPage,
          leaveRoomForPrevPageButton: pages.length > 0,
          leaveRoomForNextPageButton: pages.length + 1 < maxPages,
          ...pageLayoutProps,
        });

        // Are we able to fill all of them now? Great, let's ship it.
        if (
          nextPageInSortedOrder.numParticipants ===
          sortedParticipantsHopingToFitOnPage.length
        ) {
          nextPage = nextPageInSortedOrder;
          break;
        }
        attemptNumber += 1;
      }

      if (!nextPage) {
        log.warn(
          `GroupCallRemoteParticipants: failed after ${attemptNumber} attempts to layout
          the page; pageIndex: ${pages.length}, \
          # fit in priority order: ${nextPageInPriorityOrder.numParticipants}, \
          # fit in sorted order:  ${nextPageInSortedOrder.numParticipants}`
        );
        nextPage = nextPageInSortedOrder;
      }
    }

    if (!nextPage) {
      break;
    }

    const nextPageTiles =
      nextPage as ParticipantsInPageType<ParticipantTileType>;

    // Add a previous page tile if needed
    if (pages.length > 0) {
      nextPageTiles.rows[0].unshift({
        isPaginationButton: true,
        paginationButtonType: 'prev',
        videoAspectRatio: PAGINATION_BUTTON_ASPECT_RATIO,
        numParticipants: getTotalParticipantsOnGrid(),
      });
    }

    if (!nextPage.numParticipants) {
      break;
    }

    remainingParticipants = remainingParticipants.slice(
      nextPage.numParticipants
    );

    pages.push(nextPage);

    if (pages.length === maxPages) {
      break;
    }

    // Add a next page tile if needed
    if (remainingParticipants.length) {
      nextPageTiles.rows.at(-1)?.push({
        isPaginationButton: true,
        paginationButtonType: 'next',
        videoAspectRatio: PAGINATION_BUTTON_ASPECT_RATIO,
        numParticipants: remainingParticipants.length,
      });
    }
  }
  return pages;
}

/**
 *  Attempt to fill a new page with as many participants as will fit, leaving room for
 *  next/prev page buttons as needed. Participants will be added in the order provided.
 *
 *  @returns ParticipantsInPageType, representing the participants that fit on this page
 *      assuming they are rendered at minimum height. Does not include prev/next buttons,
 *      but will leave space for them if needed. Participants are not necessarily
 *      returned in the row-distribution that will maximize video scaling; that should
 *      be done subsequently.
 */
function getNextPage({
  participants,
  maxRowWidth,
  minRenderedHeight,
  maxRowsPerPage,
  maxParticipantsPerPage,
  leaveRoomForPrevPageButton,
  leaveRoomForNextPageButton,
  isSubsetOfAllParticipants,
}: PageLayoutPropsType & {
  participants: Array<GroupCallRemoteParticipantType>;
  leaveRoomForPrevPageButton: boolean;
  leaveRoomForNextPageButton: boolean;
  isSubsetOfAllParticipants?: boolean;
}): ParticipantsInPageType<GroupCallRemoteParticipantType> {
  const paginationButtonWidth = participantWidthAtHeight(
    {
      videoAspectRatio: PAGINATION_BUTTON_ASPECT_RATIO,
    },
    minRenderedHeight
  );
  let rowWidth = leaveRoomForPrevPageButton
    ? paginationButtonWidth + PARTICIPANT_MARGIN
    : 0;

  // Initialize fresh page with empty first row
  const rows: Array<Array<GroupCallRemoteParticipantType>> = [[]];
  let row = rows[0];
  let numParticipants = 0;

  // Start looping through participants and adding them to the rows one-by-one
  for (let i = 0; i < participants.length; i += 1) {
    const participant = participants[i];
    const isLastParticipant =
      !isSubsetOfAllParticipants && i === participants.length - 1;

    const participantWidth = participantWidthAtHeight(
      participant,
      minRenderedHeight
    );
    const isLastRow = rows.length === maxRowsPerPage;
    const shouldShowNextButtonInThisRow =
      isLastRow && !isLastParticipant && leaveRoomForNextPageButton;

    const currentRowMaxWidth = shouldShowNextButtonInThisRow
      ? maxRowWidth - (paginationButtonWidth + PARTICIPANT_MARGIN)
      : maxRowWidth;

    const participantFitsOnRow =
      rowWidth + participantWidth + (row.length ? PARTICIPANT_MARGIN : 0) <=
      currentRowMaxWidth;

    if (participantFitsOnRow) {
      rowWidth += participantWidth + (row.length ? PARTICIPANT_MARGIN : 0);
      row.push(participant);
      numParticipants += 1;

      if (numParticipants === maxParticipantsPerPage) {
        return { rows, numParticipants };
      }
    } else {
      if (isLastRow) {
        return { rows, numParticipants };
      }

      // Start a new row!
      row = [participant];
      rows.push(row);
      numParticipants += 1;
      rowWidth = participantWidth;
    }
  }
  return {
    rows,
    numParticipants,
  };
}

/**
 *  Given an arrangement of participants in rows that we know fits on a page at minimum
 *  rendered height, try to find an arrangement that maximizes video size, or return the
 *  provided arrangement with maximal video size. The result of this is ready to be
 *  laid out on the screen.
 *
 *  @returns GridArrangement: {
 *        rows: participants in rows,
 *        scalar: the scalar by which can scale every video on the page and still fit
 *  }
 */
function arrangeParticipantsInGrid({
  participantsInRows,
  maxRowWidth,
  minRenderedHeight,
  maxRowsPerPage,
  maxGridHeight,
}: {
  participantsInRows: Array<Array<ParticipantTileType>>;
  maxRowWidth: number;
  minRenderedHeight: number;
  maxRowsPerPage: number;
  maxGridHeight: number;
}): GridArrangement {
  // Start out with the arrangement that was prepared by getGridParticipantsByPage.
  //   We know this arrangement (added one-by-one) fits, so its scalar is
  //   guaranteed to be >= 1. Our chunking strategy below might not arrive at such
  //   an arrangement.
  let bestArrangement: GridArrangement = {
    scalar: getMaximumScaleForRows({
      maxRowWidth,
      minRenderedHeight,
      rows: participantsInRows,
      maxGridHeight,
    }),
    rows: participantsInRows,
  };

  const participants = participantsInRows.flat();

  // For each possible number of rows (starting at 0 and ending at `maxRowCount`),
  //   distribute participants across the rows at the minimum height. Then find the
  //   "scalar": how much can we scale these boxes up while still fitting them on the
  //   screen? The biggest scalar wins as the "best arrangement".
  for (let rowCount = 1; rowCount <= maxRowsPerPage; rowCount += 1) {
    // We do something pretty naïve here and chunk the grid's participants into rows.
    //   For example, if there were 12 grid participants and `rowCount === 3`, there
    //   would be 4 participants per row.
    //
    // This naïve chunking is suboptimal in terms of absolute best fit, but it is much
    //   faster and simpler than trying to do this perfectly. In practice, this works
    //   fine in the UI from our testing.
    const numberOfParticipantsInRow = Math.ceil(participants.length / rowCount);
    const rows = chunk(participants, numberOfParticipantsInRow);

    const scalar = getMaximumScaleForRows({
      maxRowWidth,
      minRenderedHeight,
      rows,
      maxGridHeight,
    });

    if (scalar > bestArrangement.scalar) {
      bestArrangement = {
        scalar,
        rows,
      };
    }
  }

  return bestArrangement;
}

// We need to find the scalar for this arrangement. Imagine that we have these
//   participants at the minimum heights, and we want to scale everything up until
//   it's about to overflow.
function getMaximumScaleForRows({
  maxRowWidth,
  minRenderedHeight,
  maxGridHeight,
  rows,
}: {
  maxRowWidth: number;
  minRenderedHeight: number;
  maxGridHeight: number;
  rows: Array<Array<ParticipantTileType>>;
}): number {
  if (!rows.length) {
    return 0;
  }
  const widestRow = maxBy(rows, x =>
    totalRowWidthAtHeight(x, minRenderedHeight)
  );

  strictAssert(widestRow, 'Could not find widestRow');

  // We don't want it to overflow horizontally or vertically, so we calculate a
  //   "width scalar" and "height scalar" and choose the smaller of the two. (Choosing
  //   the LARGER of the two could cause overflow.)
  const widthScalar =
    (maxRowWidth - (widestRow.length - 1) * PARTICIPANT_MARGIN) /
    totalRowWidthAtHeight(widestRow, minRenderedHeight);

  const heightScalar =
    (maxGridHeight - (rows.length - 1) * PARTICIPANT_MARGIN) /
    (rows.length * minRenderedHeight);

  return Math.min(widthScalar, heightScalar);
}

function isGroupCallRemoteParticipant(
  tile: ParticipantTileType
): tile is GroupCallRemoteParticipantType {
  return 'demuxId' in tile;
}

function isPaginationButton(
  tile: ParticipantTileType
): tile is PaginationButtonType {
  return 'isPaginationButton' in tile;
}
