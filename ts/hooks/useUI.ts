import { useSelector } from 'react-redux';
import { isRightPanelShowing } from '../state/selectors/conversations';

export function useIsRightPanelShowing(): boolean {
  return useSelector(isRightPanelShowing);
}
