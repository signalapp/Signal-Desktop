// https://css-tricks.com/converting-color-spaces-in-javascript
export function hexColorToRGB(hexColor: string): string {
  let red = 0;
  let green = 0;
  let blue = 0;

  // 3 digits
  if (hexColor.length === 4) {
    red = Number(`0x${hexColor[1]}${hexColor[1]}`);
    green = Number(`0x${hexColor[2]}${hexColor[2]}`);
    blue = Number(`0x${hexColor[3]}${hexColor[3]}`);

    // 6 digits
  } else if (hexColor.length === 7) {
    red = Number(`0x${hexColor[1]}${hexColor[2]}`);
    green = Number(`0x${hexColor[3]}${hexColor[4]}`);
    blue = Number(`0x${hexColor[5]}${hexColor[6]}`);
  }

  return `${red}, ${green}, ${blue}`;
}
