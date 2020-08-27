import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { CallManager } from '../../components/CallManager';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';

import { SmartCallingDeviceSelection } from './CallingDeviceSelection';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredCallingDeviceSelection = SmartCallingDeviceSelection as any;

function renderDeviceSelection(): JSX.Element {
  return <FilteredCallingDeviceSelection />;
}

const mapStateToProps = (state: StateType) => {
  return {
    ...state.calling,
    i18n: getIntl(state),
    renderDeviceSelection,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
