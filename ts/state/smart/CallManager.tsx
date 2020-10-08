import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { CallManager } from '../../components/CallManager';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';

import { SmartCallingDeviceSelection } from './CallingDeviceSelection';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredCallingDeviceSelection = SmartCallingDeviceSelection as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function renderDeviceSelection(): JSX.Element {
  return <FilteredCallingDeviceSelection />;
}

const mapStateToProps = (state: StateType) => {
  const { calling } = state;
  return {
    ...calling,
    i18n: getIntl(state),
    renderDeviceSelection,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallManager = smart(CallManager);
