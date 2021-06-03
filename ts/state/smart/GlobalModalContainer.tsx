// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { GlobalModalContainer } from '../../components/GlobalModalContainer';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { SmartChatColorPicker } from './ChatColorPicker';

function renderChatColorPicker(): JSX.Element {
  return <SmartChatColorPicker />;
}

const mapStateToProps = (state: StateType) => {
  return {
    ...state.globalModals,
    i18n: getIntl(state),
    renderChatColorPicker,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGlobalModalContainer = smart(GlobalModalContainer);
