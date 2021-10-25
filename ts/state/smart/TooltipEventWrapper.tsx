// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { Ref } from 'react';
import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';

import { TooltipEventWrapper } from '../../components/TooltipEventWrapper';
import { getInteractionMode } from '../selectors/user';

type ExternalProps = {
  // Matches Popper's RefHandler type
  innerRef: Ref<HTMLElement>;
  children: React.ReactNode;
  onHoverChanged: (_: boolean) => void;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  return {
    ...props,
    interactionMode: getInteractionMode(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTooltipEventWrapper = smart(TooltipEventWrapper);
