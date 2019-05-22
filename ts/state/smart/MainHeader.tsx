import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { MainHeader } from '../../components/MainHeader';
import { StateType } from '../reducer';

import { getQuery } from '../selectors/search';
import { getIntl, getRegionCode, getUserNumber } from '../selectors/user';
import { getMe } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  return {
    searchTerm: getQuery(state),
    regionCode: getRegionCode(state),
    ourNumber: getUserNumber(state),
    ...getMe(state),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMainHeader = smart(MainHeader);
