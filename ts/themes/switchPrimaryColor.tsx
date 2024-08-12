import { Dispatch } from '@reduxjs/toolkit';
import { find } from 'lodash';
import { applyPrimaryColor } from '../state/ducks/primaryColor';
import { COLORS, ColorsType, getPrimaryColors, PrimaryColorStateType } from './constants/colors';

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
    COLORS.PRIMARY[`${color.toUpperCase() as keyof ColorsType['PRIMARY']}`]
  );
  dispatch?.(applyPrimaryColor(color));
}
