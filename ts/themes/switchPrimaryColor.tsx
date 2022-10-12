import { find } from 'lodash';
import { Dispatch } from '@reduxjs/toolkit';
import { applyPrimaryColor } from '../state/ducks/primaryColor';
import { COLORS, getPrimaryColors, PrimaryColorStateType } from './constants/colors';

export function findPrimaryColorId(hexCode: string): PrimaryColorStateType | undefined {
  const primaryColors = getPrimaryColors();
  return find(primaryColors, { color: hexCode })?.id;
}

export async function switchPrimaryColorTo(color: PrimaryColorStateType, dispatch?: Dispatch) {
  if (window.Events) {
    await window.Events.setPrimaryColorSetting(color);
  }

  document.documentElement.style.setProperty(
    '--primary-color',
    (COLORS.PRIMARY as any)[`${color.toUpperCase()}`]
  );
  dispatch?.(applyPrimaryColor(color));
}
