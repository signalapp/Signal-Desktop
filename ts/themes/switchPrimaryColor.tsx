import { Dispatch } from 'redux';
import { applyPrimaryColor } from '../state/ducks/primaryColor';
import { COLORS, PrimaryColorStateType } from './colors';

export function switchPrimaryColor(color: PrimaryColorStateType, dispatch: Dispatch | null) {
  document.documentElement.style.setProperty(
    '--primary-color',
    (COLORS.PRIMARY as any)[`${color.toUpperCase()}`]
  );
  dispatch?.(applyPrimaryColor(color));
}
