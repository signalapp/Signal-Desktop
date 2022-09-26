import { COLORS, PrimaryColorStateType } from './colors';

export function switchPrimaryColor(color: PrimaryColorStateType) {
  document.documentElement.style.setProperty(
    '--primary-color',
    (COLORS.PRIMARY as any)[`${color.toUpperCase()}`]
  );
  // TODO Store in Database
}
