import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { RelinkDialog } from '../../components/RelinkDialog';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { hasNetworkDialog } from '../selectors/network';
import { isDone } from '../../util/registration';

const mapStateToProps = (state: StateType) => {
  return {
    hasNetworkDialog: hasNetworkDialog(state),
    i18n: getIntl(state),
    isRegistrationDone: isDone(),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartRelinkDialog = smart(RelinkDialog);
