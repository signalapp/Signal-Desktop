// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';

import { CollapseSetViewer } from './CollapseSet.dom.js';

import type { Props } from './CollapseSet.dom.js';
import type { RenderItemProps } from '../../state/smart/TimelineItem.preload.js';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.js';
import { WidthBreakpoint } from '../_util.std.js';
import { tw } from '../../axo/tw.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/CollapseSet',
} satisfies Meta<Props>;

function renderItem({ item }: RenderItemProps) {
  return (
    <div className={tw('py-2.5 text-center')}>
      Message {item.id} - <a href="https://signal.org">Use Signal</a>
    </div>
  );
}

const defaultProps: Props = {
  containerElementRef: React.createRef<HTMLElement | null>(),
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  conversationId: 'c1',
  i18n,
  id: 'id1',
  isBlocked: false,
  isGroup: true,
  messages: undefined,
  renderItem,
  targetedMessage: undefined,
  type: 'none',
};

export function GroupWithTwo(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'group-updates',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
    ],
  };
  return <CollapseSetViewer {...props} />;
}

export function AutoexpandIfTargeted(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'group-updates',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
    ],
    targetedMessage: {
      id: 'id1',
      counter: 1,
    },
  };
  return <CollapseSetViewer {...props} />;
}

export function GroupWithOneThatHasExtra(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'group-updates',
    messages: [{ id: 'id1 (with one extra)', isUnseen: false, extraItems: 1 }],
  };
  return <CollapseSetViewer {...props} />;
}

export function GroupWithTwoThatHaveExtra(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'group-updates',
    messages: [
      { id: 'id1 (with one extra)', isUnseen: false, extraItems: 1 },
      { id: 'id2 (with two extra)', isUnseen: false, extraItems: 2 },
    ],
  };
  return <CollapseSetViewer {...props} />;
}

export function GroupWithTen(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'group-updates',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
      { id: 'id3', isUnseen: false },
      { id: 'id4', isUnseen: false },
      { id: 'id5', isUnseen: false },
      { id: 'id6', isUnseen: false },
      { id: 'id7', isUnseen: false },
      { id: 'id8', isUnseen: false },
      { id: 'id9', isUnseen: false },
      { id: 'id10', isUnseen: false },
    ],
  };
  return (
    <div>
      <div className={tw('py-2.5 text-center')}>
        Message id0 - <a href="https://signal.org">Use Signal</a>
      </div>
      <CollapseSetViewer {...props} />
      <div className={tw('py-2.5 text-center')}>
        Message id11 - <a href="https://signal.org">Use Signal</a>
      </div>
    </div>
  );
}

export function TimerWithTwoUndefined(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'timer-changes',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
    ],
    endingState: undefined,
  };
  return <CollapseSetViewer {...props} />;
}

export function TimerWithTwoZero(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'timer-changes',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
    ],
    endingState: DurationInSeconds.fromSeconds(0),
  };
  return <CollapseSetViewer {...props} />;
}

export function TimerWithTwoAt15m(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'timer-changes',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
    ],
    endingState: DurationInSeconds.fromSeconds(60 * 15),
  };
  return <CollapseSetViewer {...props} />;
}

export function TimerWithTenAt1Hr(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'timer-changes',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
      { id: 'id3', isUnseen: false },
      { id: 'id4', isUnseen: false },
      { id: 'id5', isUnseen: false },
      { id: 'id6', isUnseen: false },
      { id: 'id7', isUnseen: false },
      { id: 'id8', isUnseen: false },
      { id: 'id9', isUnseen: false },
      { id: 'id10', isUnseen: false },
    ],
    endingState: DurationInSeconds.fromSeconds(60 * 60),
  };
  return <CollapseSetViewer {...props} />;
}

export function GroupWithTwoOneUnseen(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'group-updates',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: true },
    ],
  };
  return <CollapseSetViewer {...props} />;
}

export function GroupWithFourTwoUnseen(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'group-updates',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
      { id: 'id3', isUnseen: true },
      { id: 'id4', isUnseen: true },
    ],
  };
  return <CollapseSetViewer {...props} />;
}

export function GroupWithFourThreeUnseen(): React.JSX.Element {
  const props: Props = {
    ...defaultProps,
    type: 'group-updates',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: true },
      { id: 'id3', isUnseen: true },
      { id: 'id4', isUnseen: true },
    ],
  };
  return <CollapseSetViewer {...props} />;
}

export function GroupWithWithUpdateAfterDelay(): React.JSX.Element {
  const [props, setProps] = React.useState<Props>({
    ...defaultProps,
    type: 'group-updates',
    messages: [
      { id: 'id1', isUnseen: false },
      { id: 'id2', isUnseen: false },
      { id: 'id3', isUnseen: true },
      { id: 'id4', isUnseen: true },
    ],
  });

  setTimeout(() => {
    setProps({
      ...defaultProps,
      type: 'group-updates',
      messages: [
        { id: 'id1', isUnseen: false },
        { id: 'id2', isUnseen: false },
        { id: 'id3', isUnseen: false },
        { id: 'id4', isUnseen: false },
        { id: 'id5', isUnseen: true },
      ],
    });
  }, 1000);
  return <CollapseSetViewer {...props} />;
}
