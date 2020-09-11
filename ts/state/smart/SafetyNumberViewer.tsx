import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SafetyNumberViewer } from '../../components/SafetyNumberViewer';
import { StateType } from '../reducer';
import { getContactSafetyNumber } from '../selectors/safetyNumber';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';

type Props = {
  contactID: string;
  onClose?: () => void;
};

const mapStateToProps = (state: StateType, props: Props) => {
  return {
    ...props,
    ...getContactSafetyNumber(state, props),
    contact: getConversationSelector(state)(props.contactID),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartSafetyNumberViewer = smart(SafetyNumberViewer);
