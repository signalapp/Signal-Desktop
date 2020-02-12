import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { NetworkStatus } from '../../components/NetworkStatus';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { hasNetworkDialog } from '../selectors/network';
import { isDone } from '../selectors/registration';

const mapStateToProps = (state: StateType) => {
  return {
    ...state.network,
    hasNetworkDialog: hasNetworkDialog(state),
    i18n: getIntl(state),
    isRegistrationDone: isDone(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartNetworkStatus = smart(NetworkStatus);
