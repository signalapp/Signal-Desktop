import { PrimaryColorStateType } from '../../themes/constants/colors';

export const APPLY_PRIMARY_COLOR = 'APPLY_PRIMARY_COLOR';

export const applyPrimaryColor = (color: PrimaryColorStateType) => {
  return {
    type: APPLY_PRIMARY_COLOR,
    payload: color,
  };
};

export const initialPrimaryColorState: PrimaryColorStateType = 'green';

export const reducer = (
  state: any = initialPrimaryColorState,
  {
    type,
    payload,
  }: {
    type: string;
    payload: PrimaryColorStateType;
  }
): PrimaryColorStateType => {
  switch (type) {
    case APPLY_PRIMARY_COLOR:
      return payload;
    default:
      return state;
  }
};

export const actions = {
  applyPrimaryColor,
};
