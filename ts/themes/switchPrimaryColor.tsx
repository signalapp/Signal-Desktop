import { Dispatch } from 'redux';
import { applyPrimaryColor } from '../state/ducks/primaryColor';
import { COLORS, PrimaryColorStateType } from './colors';

export async function switchPrimaryColor(color: PrimaryColorStateType, dispatch: Dispatch | null) {
  await window.Events.setPrimaryColorSetting(color);

  document.documentElement.style.setProperty(
    '--primary-color',
    (COLORS.PRIMARY as any)[`${color.toUpperCase()}`]
  );
  dispatch?.(applyPrimaryColor(color));
}
