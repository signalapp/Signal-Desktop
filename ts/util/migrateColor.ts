// import { missingCaseError } from './missingCaseError';

type OldColor =
  | 'amber'
  | 'blue'
  | 'blue_grey'
  | 'cyan'
  | 'deep_orange'
  | 'deep_purple'
  | 'green'
  | 'grey'
  | 'indigo'
  | 'light_blue'
  | 'light_green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal';

type NewColor =
  | 'blue'
  | 'cyan'
  | 'deep_orange'
  | 'grey'
  | 'green'
  | 'indigo'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal';

export function migrateColor(color: OldColor): NewColor {
  switch (color) {
    // These colors no longer exist
    case 'amber':
    case 'orange':
      return 'red';

    case 'blue_grey':
    case 'light_blue':
      return 'blue';

    case 'deep_purple':
      return 'purple';

    case 'light_green':
      return 'teal';

    // These can stay as they are
    case 'blue':
    case 'cyan':
    case 'deep_orange':
    case 'green':
    case 'grey':
    case 'indigo':
    case 'pink':
    case 'purple':
    case 'red':
    case 'teal':
      return color;

    // Can uncomment this to ensure that we've covered all potential cases
    // default:
    //   throw missingCaseError(color);

    default:
      return 'grey';
  }
}
