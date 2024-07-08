// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { times } from 'lodash';
import { v4 as uuid } from 'uuid';
import type { LastMessageStatus } from '../../model-types.d';
import { MINUTE, SECOND } from '../../util/durations';
import type { MaybeMessageTimelineItemType } from '../../util/timelineUtil';
import {
  ScrollAnchor,
  areMessagesInSameGroup,
  getScrollAnchorBeforeUpdate,
  shouldCurrentMessageHideMetadata,
  TimelineMessageLoadingState,
} from '../../util/timelineUtil';

describe('<Timeline> utilities', () => {
  describe('areMessagesInSameGroup', () => {
    const defaultNewer: MaybeMessageTimelineItemType = {
      type: 'message' as const,
      data: {
        author: { id: uuid() },
        timestamp: new Date(1998, 10, 21, 12, 34, 56, 123).valueOf(),
        status: 'delivered',
      },
    };
    const defaultOlder: MaybeMessageTimelineItemType = {
      ...defaultNewer,
      data: {
        ...defaultNewer.data,
        timestamp: defaultNewer.data.timestamp - MINUTE,
        status: 'delivered',
      },
    };

    it('returns false if either item is missing', () => {
      assert.isFalse(areMessagesInSameGroup(undefined, false, undefined));
      assert.isFalse(areMessagesInSameGroup(defaultNewer, false, undefined));
      assert.isFalse(areMessagesInSameGroup(undefined, false, defaultNewer));
    });

    it("returns false if authors don't match", () => {
      const older = {
        ...defaultOlder,
        data: { ...defaultOlder.data, author: { id: uuid() } },
      };

      assert.isFalse(areMessagesInSameGroup(older, false, defaultNewer));
    });

    it('returns false if the older item was sent more than 3 minutes before', () => {
      const older = {
        ...defaultNewer,
        data: {
          ...defaultNewer.data,
          timestamp: defaultNewer.data.timestamp - 3 * MINUTE - SECOND,
        },
      };

      assert.isFalse(areMessagesInSameGroup(older, false, defaultNewer));
    });

    it('returns false if the older item was somehow sent in the future', () => {
      assert.isFalse(areMessagesInSameGroup(defaultNewer, false, defaultOlder));
    });

    it("returns false if the older item was sent across a day boundary, even if they're otherwise <3m apart", () => {
      const older = {
        ...defaultOlder,
        data: {
          ...defaultOlder.data,
          timestamp: new Date(2000, 2, 2, 23, 59, 0, 0).valueOf(),
        },
      };
      const newer = {
        ...defaultNewer,
        data: {
          ...defaultNewer.data,
          timestamp: new Date(2000, 2, 3, 0, 1, 0, 0).valueOf(),
        },
      };
      assert.isBelow(
        newer.data.timestamp - older.data.timestamp,
        3 * MINUTE,
        'Test was set up incorrectly'
      );

      assert.isFalse(areMessagesInSameGroup(older, false, newer));
    });

    it('returns false if the older item has reactions', () => {
      const older = {
        ...defaultOlder,
        data: { ...defaultOlder.data, reactions: [{}] },
      };

      assert.isFalse(areMessagesInSameGroup(older, false, defaultNewer));
    });

    it("returns false if there's an unread indicator in the middle", () => {
      assert.isFalse(areMessagesInSameGroup(defaultOlder, true, defaultNewer));
    });

    it('returns true if everything above works out', () => {
      assert.isTrue(areMessagesInSameGroup(defaultOlder, false, defaultNewer));
    });
  });

  describe('shouldCurrentMessageHideMetadata', () => {
    const defaultNewer: MaybeMessageTimelineItemType = {
      type: 'message' as const,
      data: {
        author: { id: uuid() },
        timestamp: new Date(1998, 10, 21, 12, 34, 56, 123).valueOf(),
        status: 'delivered',
      },
    };
    const defaultCurrent: MaybeMessageTimelineItemType = {
      type: 'message' as const,
      data: {
        author: { id: uuid() },
        timestamp: defaultNewer.data.timestamp - MINUTE,
        status: 'delivered',
      },
    };

    it("returns false if messages aren't grouped", () => {
      assert.isFalse(
        shouldCurrentMessageHideMetadata(false, defaultCurrent, defaultNewer)
      );
    });

    it('returns false if newer item is missing', () => {
      assert.isFalse(
        shouldCurrentMessageHideMetadata(true, defaultCurrent, undefined)
      );
    });

    it('returns false if newer is deletedForEveryone', () => {
      const newer = {
        ...defaultNewer,
        data: { ...defaultNewer.data, deletedForEveryone: true },
      };

      assert.isFalse(
        shouldCurrentMessageHideMetadata(true, defaultCurrent, newer)
      );
    });

    it('returns false if current message is unsent, even if its status matches the newer one', () => {
      const statuses: ReadonlyArray<LastMessageStatus> = [
        'paused',
        'error',
        'partial-sent',
        'sending',
      ];
      for (const status of statuses) {
        const sameStatusNewer: MaybeMessageTimelineItemType = {
          ...defaultNewer,
          data: { ...defaultNewer.data, status },
        };
        const current: MaybeMessageTimelineItemType = {
          ...defaultCurrent,
          data: { ...defaultCurrent.data, status },
        };

        assert.isFalse(
          shouldCurrentMessageHideMetadata(true, current, defaultNewer)
        );
        assert.isFalse(
          shouldCurrentMessageHideMetadata(true, current, sameStatusNewer)
        );
      }
    });

    it('returns true if all messages are sent (but no higher)', () => {
      const newer = {
        ...defaultNewer,
        data: { ...defaultNewer.data, status: 'sent' as const },
      };
      const current = {
        ...defaultCurrent,
        data: { ...defaultCurrent.data, status: 'sent' as const },
      };

      assert.isTrue(shouldCurrentMessageHideMetadata(true, current, newer));
    });

    it('returns true if both have delivered status or above', () => {
      assert.isTrue(
        shouldCurrentMessageHideMetadata(true, defaultCurrent, defaultNewer)
      );
    });

    it('returns true if both the current and next messages are deleted for everyone', () => {
      const current = {
        ...defaultCurrent,
        data: { ...defaultCurrent.data, deletedForEveryone: true },
      };
      const newer = {
        ...defaultNewer,
        data: { ...defaultNewer.data, deletedForEveryone: true },
      };

      assert.isTrue(shouldCurrentMessageHideMetadata(true, current, newer));
    });
  });

  describe('getScrollAnchorBeforeUpdate', () => {
    const fakeItems = (count: number) => times(count, () => uuid());

    const defaultProps = {
      haveNewest: true,
      isIncomingMessageRequest: false,
      isSomeoneTyping: false,
      items: fakeItems(10),
      scrollToIndexCounter: 0,
      messageLoadingState: null,
      oldestUnseenIndex: null,
      scrollToIndex: null,
    } as const;

    describe('during initial load', () => {
      it('does nothing if messages are loading for the first time', () => {
        const prevProps = {
          ...defaultProps,
          haveNewest: false,
          items: [],
          messageLoadingStates: TimelineMessageLoadingState.DoingInitialLoad,
        };
        const props = { ...prevProps, isSomeoneTyping: true };
        const isAtBottom = true;

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ChangeNothing
        );
      });
    });

    it('scrolls to an index when applicable', () => {
      const props1 = defaultProps;
      const props2 = {
        ...defaultProps,
        scrollToIndex: 123,
        scrollToIndexCounter: 1,
      };
      const props3 = {
        ...defaultProps,
        scrollToIndex: 123,
        scrollToIndexCounter: 2,
      };
      const props4 = {
        ...defaultProps,
        scrollToIndex: 456,
        scrollToIndexCounter: 2,
      };
      const isAtBottom = false;

      assert.strictEqual(
        getScrollAnchorBeforeUpdate(props1, props2, isAtBottom),
        ScrollAnchor.ScrollToIndex
      );
      assert.strictEqual(
        getScrollAnchorBeforeUpdate(props2, props3, isAtBottom),
        ScrollAnchor.ScrollToIndex
      );
      assert.strictEqual(
        getScrollAnchorBeforeUpdate(props3, props4, isAtBottom),
        ScrollAnchor.ScrollToIndex
      );
    });

    describe('when initial load completes', () => {
      const defaultPrevProps = {
        ...defaultProps,
        haveNewest: false,
        items: [],
        messageLoadingState: TimelineMessageLoadingState.DoingInitialLoad,
      };
      const isAtBottom = true;

      it('does nothing if there are no items', () => {
        const props = { ...defaultProps, items: [] };

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(defaultPrevProps, props, isAtBottom),
          ScrollAnchor.ChangeNothing
        );
      });

      it('scrolls to the item index if applicable', () => {
        const prevProps = { ...defaultPrevProps, scrollToIndex: 3 };
        const props = {
          ...defaultProps,
          items: fakeItems(10),
          scrollToIndex: 3,
        };

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ScrollToIndex
        );
      });

      it("does nothing if it's an incoming message request", () => {
        const prevProps = {
          ...defaultPrevProps,
          isIncomingMessageRequest: true,
        };
        const props = {
          ...defaultProps,
          items: fakeItems(10),
          isIncomingMessageRequest: true,
        };

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ChangeNothing
        );
      });

      it('scrolls to the unread indicator if one exists', () => {
        const props = {
          ...defaultProps,
          items: fakeItems(10),
          oldestUnseenIndex: 3,
        };

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(defaultPrevProps, props, isAtBottom),
          ScrollAnchor.ScrollToUnreadIndicator
        );
      });

      it('scrolls to the bottom in normal cases', () => {
        const props = {
          ...defaultProps,
          items: fakeItems(3),
        };

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(defaultPrevProps, props, isAtBottom),
          ScrollAnchor.ScrollToBottom
        );
      });
    });

    describe('when a page of messages is loaded at the top', () => {
      it('uses bottom-anchored scrolling', () => {
        const oldItems = fakeItems(5);
        const prevProps = {
          ...defaultProps,
          messageLoadingState: TimelineMessageLoadingState.LoadingOlderMessages,
          items: oldItems,
        };
        const props = {
          ...defaultProps,
          items: [...fakeItems(10), ...oldItems],
        };

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, false),
          ScrollAnchor.Bottom
        );
        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, true),
          ScrollAnchor.Bottom
        );
      });
    });

    describe('when a page of messages is loaded at the bottom', () => {
      it('uses top-anchored scrolling', () => {
        const oldItems = fakeItems(5);
        const prevProps = {
          ...defaultProps,
          messageLoadingState: TimelineMessageLoadingState.LoadingNewerMessages,
          items: oldItems,
        };
        const props = {
          ...defaultProps,
          items: [...oldItems, ...fakeItems(10)],
        };

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, false),
          ScrollAnchor.Top
        );
        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, true),
          ScrollAnchor.Top
        );
      });
    });

    describe('when a new message comes in', () => {
      const oldItems = fakeItems(5);
      const prevProps = { ...defaultProps, items: oldItems };
      const props = { ...defaultProps, items: [...oldItems, uuid()] };

      it('does nothing if not scrolled to the bottom', () => {
        const isAtBottom = false;

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ChangeNothing
        );
      });

      it('stays at the bottom if already there', () => {
        const isAtBottom = true;

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ScrollToBottom
        );
      });
    });

    describe('when items are removed', () => {
      const oldItems = fakeItems(5);
      const prevProps = { ...defaultProps, items: oldItems };

      const propsWithSomethingRemoved = [
        { ...defaultProps, items: oldItems.slice(1) },
        {
          ...defaultProps,
          items: oldItems.filter((_value, index) => index !== 2),
        },
        { ...defaultProps, items: oldItems.slice(0, -1) },
      ];

      it('does nothing if not scrolled to the bottom', () => {
        const isAtBottom = false;

        propsWithSomethingRemoved.forEach(props => {
          assert.strictEqual(
            getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
            ScrollAnchor.ChangeNothing
          );
        });
      });

      it('stays at the bottom if already there', () => {
        const isAtBottom = true;

        propsWithSomethingRemoved.forEach(props => {
          assert.strictEqual(
            getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
            ScrollAnchor.ScrollToBottom
          );
        });
      });
    });

    describe('when the typing indicator appears', () => {
      const prevProps = defaultProps;

      it("does nothing if we don't have the newest messages (and therefore shouldn't show the indicator)", () => {
        [true, false].forEach(isAtBottom => {
          const props = {
            ...defaultProps,
            haveNewest: false,
            isSomeoneTyping: true,
          };

          assert.strictEqual(
            getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
            ScrollAnchor.ChangeNothing
          );
        });
      });

      it('does nothing if not scrolled to the bottom', () => {
        const props = { ...defaultProps, isSomeoneTyping: true };
        const isAtBottom = false;

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ChangeNothing
        );
      });

      it('uses bottom-anchored scrolling if scrolled to the bottom', () => {
        const props = { ...defaultProps, isSomeoneTyping: true };
        const isAtBottom = true;

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ScrollToBottom
        );
      });
    });

    describe('when the typing indicator disappears', () => {
      const prevProps = { ...defaultProps, isSomeoneTyping: true };

      it("does nothing if we don't have the newest messages (and therefore shouldn't show the indicator)", () => {
        [true, false].forEach(isAtBottom => {
          const props = {
            ...defaultProps,
            haveNewest: false,
            isSomeoneTyping: false,
          };

          assert.strictEqual(
            getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
            ScrollAnchor.ChangeNothing
          );
        });
      });

      it('does nothing if not scrolled to the bottom', () => {
        const props = { ...defaultProps, isSomeoneTyping: false };
        const isAtBottom = false;

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ChangeNothing
        );
      });

      it('uses bottom-anchored scrolling if scrolled to the bottom', () => {
        const props = { ...defaultProps, isSomeoneTyping: false };
        const isAtBottom = true;

        assert.strictEqual(
          getScrollAnchorBeforeUpdate(prevProps, props, isAtBottom),
          ScrollAnchor.ScrollToBottom
        );
      });
    });
  });
});
