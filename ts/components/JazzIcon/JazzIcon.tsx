// Modified from https://github.com/redlanta/react-jazzicon

import React from 'react';
import Color from 'color';
import { Paper } from './Paper';
import { RNG } from './RNG';

const defaultColors = [
  '#01888c', // teal
  '#fc7500', // bright orange
  '#034f5d', // dark teal
  '#E784BA', // light pink
  '#81C8B6', // bright green
  '#c7144c', // raspberry
  '#f3c100', // goldenrod
  '#1598f2', // lightning blue
  '#2465e1', // sail blue
  '#f19e02', // gold
];

const isColor = (str: string) => /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(str);
const isColors = (arr: Array<string>) => {
  if (!Array.isArray(arr)) {
    return false;
  }

  if (arr.every(value => typeof value === 'string' && isColor(value))) {
    return true;
  }

  return false;
};

interface Props {
  diameter: number;
  seed: number;
  paperStyles?: Object;
  svgStyles?: Object;
  shapeCount?: number;
  wobble?: number;
  colors?: Array<string>;
}

// tslint:disable-next-line no-http-string
const svgns = 'http://www.w3.org/2000/svg';
const shapeCount = 4;
const wobble = 30;

export class JazzIcon extends React.PureComponent<Props> {
  public render() {
    const {
      colors: customColors,
      diameter,
      paperStyles,
      seed,
      svgStyles,
    } = this.props;

    const generator = new RNG(seed);

    const colors = customColors || defaultColors;

    const newColours = this.hueShift(
      this.colorsForIcon(colors).slice(),
      generator
    );
    const shapesArr = Array(shapeCount).fill(null);
    const shuffledColours = this.shuffleArray(newColours, generator);

    return (
      <Paper color={shuffledColours[0]} diameter={diameter} style={paperStyles}>
        <svg
          xmlns={svgns}
          x="0"
          y="0"
          height={diameter}
          width={diameter}
          style={svgStyles}
        >
          {shapesArr.map((_, i) =>
            this.genShape(
              shuffledColours[i + 1],
              diameter,
              i,
              shapeCount - 1,
              generator
            )
          )}
        </svg>
      </Paper>
    );
  }

  private hueShift(colors: Array<string>, generator: RNG) {
    const amount = generator.random() * 30 - wobble / 2;

    return colors.map(hex =>
      Color(hex)
        .rotate(amount)
        .hex()
    );
  }

  private genShape(
    colour: string,
    diameter: number,
    i: number,
    total: number,
    generator: RNG
  ) {
    const center = diameter / 2;
    const firstRot = generator.random();
    const angle = Math.PI * 2 * firstRot;
    const velocity =
      diameter / total * generator.random() + i * diameter / total;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;
    const translate = `translate(${tx} ${ty})`;

    // Third random is a shape rotation on top of all of that.
    const secondRot = generator.random();
    const rot = firstRot * 360 + secondRot * 180;
    const rotate = `rotate(${rot.toFixed(1)} ${center} ${center})`;
    const transform = `${translate} ${rotate}`;

    return (
      <rect
        key={i}
        x="0"
        y="0"
        rx="0"
        ry="0"
        height={diameter}
        width={diameter}
        transform={transform}
        fill={colour}
      />
    );
  }

  private colorsForIcon(arr: Array<string>) {
    if (isColors(arr)) {
      return arr;
    }

    return defaultColors;
  }

  private shuffleArray<T>(array: Array<T>, generator: RNG) {
    let currentIndex = array.length;
    const newArray = [...array];

    // While there remain elements to shuffle...
    while (currentIndex > 0) {
      // Pick a remaining element...
      const randomIndex = generator.next() % currentIndex;
      currentIndex -= 1;
      // And swap it with the current element.
      const temporaryValue = newArray[currentIndex];
      newArray[currentIndex] = newArray[randomIndex];
      newArray[randomIndex] = temporaryValue;
    }

    return newArray;
  }
}
