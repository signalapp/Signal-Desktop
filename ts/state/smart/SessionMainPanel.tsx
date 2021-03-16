import { connect } from 'react-redux';
import { StateType } from '../reducer';

import { mapDispatchToProps } from '../actions';
import { getFocusedSettingsSection } from '../selectors/section';
import { getTheme } from '../selectors/theme';
import { SessionMainPanel } from '../../components/SessionMainPanel';

const mapStateToProps = (state: StateType) => {
  return {
    theme: getTheme(state),
    focusedSettingsSection: getFocusedSettingsSection(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartSessionMainPanel = smart(SessionMainPanel);
