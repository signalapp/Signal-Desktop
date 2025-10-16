// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';
import type { DonationReceipt } from '../types/Donations.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { strictAssert } from './assert.std.js';
import { getDateTimeFormatter } from './formatTimestamp.dom.js';
import { isStagingServer } from './isStagingServer.dom.js';
import {
  getHumanDonationAmount,
  toHumanCurrencyString,
} from './currency.dom.js';

const SCALING_FACTOR = 4.17;

// Color constants matching SCSS variables
const COLORS = {
  WHITE: '#ffffff',
  GRAY_20: '#c6c6c6',
  GRAY_45: '#848484',
  GRAY_60: '#5e5e5e',
  GRAY_90: '#1b1b1b',
  GRAY_95: '#121212',
} as const;

/**
 * Helper function to scale font sizes, heights, and letter spacing for the receipt
 * NOTE: letterSpacing does not work for arabic, breaks the script
 * @param params - Object containing original values to scale
 * @param params.fontSize - Original font size in pixels
 * @param params.height - Optional original height/margin/padding in pixels
 * @param params.letterSpacing - Optional original letter spacing in pixels
 * @returns Scaled values for use in FabricJS
 */
function scaleValues(params: {
  fontSize: number;
  height?: number;
  letterSpacing?: number;
}): {
  fontSize: number;
  height?: number;
  charSpacing?: number;
} {
  const result: {
    fontSize: number;
    height?: number;
    charSpacing?: number;
  } = {
    fontSize: params.fontSize * SCALING_FACTOR,
  };

  if (params.height !== undefined) {
    result.height = params.height * SCALING_FACTOR;
  }

  if (params.letterSpacing !== undefined) {
    // FabricJS charSpacing is in thousandths of em units
    // Formula: (letterSpacingPx * 1000) / fontSizePx
    // This converts pixel-based letter spacing to em-based units
    // For example: -0.13px letter spacing on 12px font =
    //    (-0.13 * 1000) / 12 = -10.83 thousandths of em
    result.charSpacing = (params.letterSpacing * 1000) / params.fontSize;
  }

  return result;
}

const SIGNAL_LOGO_SVG = `<svg width="417" height="121" viewBox="0 0 560 160" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M80 0C84.1505 0 88.2271 0.31607 92.2072 0.925452L91.0628 8.3387C87.4559 7.78644 83.7614 7.5 80 7.5C76.2388 7.5 72.5445 7.78641 68.9377 8.33862L67.7933 0.925375C71.7732 0.316043 75.8497 0 80 0Z" fill="#3B45FD"/>
<path d="M98.9849 2.26619L97.2051 9.55374C104.515 11.3327 111.39 14.2198 117.644 18.0268L121.539 11.6158C114.638 7.41489 107.051 4.22922 98.9849 2.26619Z" fill="#3B45FD"/>
<path d="M127.279 15.4591L122.847 21.5098C128.824 25.8959 134.104 31.1762 138.49 37.1535L144.541 32.7211C139.701 26.1254 133.875 20.2989 127.279 15.4591Z" fill="#3B45FD"/>
<path d="M148.384 38.4618L141.973 42.356C145.78 48.6101 148.667 55.4859 150.446 62.7955L157.734 61.0157C155.771 52.95 152.585 45.3629 148.384 38.4618Z" fill="#3B45FD"/>
<path d="M159.075 67.7934L151.661 68.9378C152.214 72.5445 152.5 76.2388 152.5 80C152.5 83.7614 152.214 87.4559 151.661 91.0628L159.075 92.2072C159.684 88.2271 160 84.1505 160 80C160 75.8497 159.684 71.7733 159.075 67.7934Z" fill="#3B45FD"/>
<path d="M141.973 117.645C145.78 111.39 148.667 104.515 150.446 97.205L157.734 98.9848C155.771 107.051 152.585 114.638 148.384 121.539L141.973 117.645Z" fill="#3B45FD"/>
<path d="M138.49 122.847L144.541 127.279C139.701 133.875 133.875 139.701 127.279 144.541L122.846 138.49C128.824 134.104 134.104 128.824 138.49 122.847Z" fill="#3B45FD"/>
<path d="M117.644 141.973L121.538 148.384C114.637 152.585 107.05 155.771 98.9843 157.734L97.2045 150.446C104.514 148.667 111.39 145.78 117.644 141.973Z" fill="#3B45FD"/>
<path d="M91.0622 151.661L92.2067 159.075C88.2268 159.684 84.1503 160 80 160C75.8495 160 71.7728 159.684 67.7927 159.075L68.9369 151.662C72.5423 152.214 76.2366 152.5 80 152.5C83.7612 152.5 87.4555 152.214 91.0622 151.661Z" fill="#3B45FD"/>
<path d="M62.7945 150.448L61.0151 157.734C54.9562 156.259 49.1674 154.095 43.7366 151.328L36.1439 153.1L34.4397 145.796L44.7001 143.402L47.1409 144.645C52.0596 147.151 57.3032 149.112 62.7945 150.448Z" fill="#3B45FD"/>
<path d="M28.1097 147.273L29.8139 154.577L16.7994 157.613C8.13861 159.634 0.365682 151.861 2.38654 143.201L5.42327 130.186L12.7271 131.89L9.69035 144.905C8.93253 148.153 11.8474 151.067 15.0952 150.31L28.1097 147.273Z" fill="#3B45FD"/>
<path d="M14.2041 125.56L6.90027 123.856L8.6719 116.263C5.90526 110.832 3.74067 105.043 2.26605 98.9843L9.55191 97.2049C10.8879 102.696 12.849 107.94 15.3547 112.859L16.5982 115.3L14.2041 125.56Z" fill="#3B45FD"/>
<path d="M8.33759 91.0624L0.925362 92.2066C0.316038 88.2267 0 84.1503 0 80C0 75.8495 0.316067 71.7729 0.925446 67.7928L8.33869 68.9372C7.78644 72.5442 7.5 76.2386 7.5 80C7.5 83.7631 7.78613 87.4572 8.33759 91.0624Z" fill="#3B45FD"/>
<path d="M9.55373 62.795L2.26618 61.0152C4.2292 52.9495 7.41488 45.3624 11.6158 38.4613L18.0268 42.3555C14.2198 48.6096 11.3327 55.4854 9.55373 62.795Z" fill="#3B45FD"/>
<path d="M21.5098 37.1531L15.4591 32.7207C20.2989 26.125 26.1254 20.2986 32.7211 15.4588L37.1535 21.5095C31.1762 25.8956 25.8959 31.1758 21.5098 37.1531Z" fill="#3B45FD"/>
<path d="M42.356 18.0266L38.4617 11.6155C45.3628 7.41468 52.9499 4.22905 61.0157 2.26606L62.7955 9.55361C55.4859 11.3326 48.6101 14.2195 42.356 18.0266Z" fill="#3B45FD"/>
<path d="M145 80C145 115.899 115.899 145 80 145C68.6134 145 57.9107 142.072 48.6035 136.928C47.7074 136.433 46.6618 136.27 45.6646 136.502L16.7512 143.249L23.4977 114.335C23.7303 113.338 23.5669 112.292 23.0717 111.396C17.9278 102.089 15 91.3865 15 80C15 44.1015 44.1015 15 80 15C115.899 15 145 44.1015 145 80Z" fill="#3B45FD"/>
<path d="M283.473 43.2773C278.004 43.2773 273.493 38.7656 273.493 33.2969C273.493 27.8281 278.004 23.3164 283.473 23.3164C288.942 23.3164 293.454 27.8281 293.454 33.2969C293.454 38.7656 288.942 43.2773 283.473 43.2773Z" fill="#3B45FD"/>
<path d="M275.202 129V52.5742H291.745V129H275.202Z" fill="#3B45FD"/>
<path d="M558.078 129V24.5469H541.535V129H558.078Z" fill="#3B45FD"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M458.716 90.7871C458.716 116.148 472.388 130.23 490.503 130.23C500.074 130.23 507.73 125.24 512.515 116.695V129H529.263V52.5742H512.515V64.8105C507.73 56.2656 500.279 51.3438 490.982 51.3438C472.388 51.3438 458.716 65.4258 458.716 90.7871ZM513.472 90.7871C513.472 106.168 506.978 116.695 494.81 116.695C482.505 116.695 476.011 105.553 476.011 90.7871C476.011 76.0215 482.505 65.3574 494.81 65.3574C506.978 65.3574 513.472 75.4062 513.472 90.7871Z" fill="#3B45FD"/>
<path d="M400.849 84.0879V129H383.964V52.5742H399.96L400.165 67.5449C404.814 56.8809 412.675 51.6172 423.749 51.6172C439.472 51.6172 449.863 61.8711 449.863 80.3965V129H432.978V82.8574C432.978 72.3301 427.167 66.041 417.665 66.041C407.89 66.041 400.849 72.6719 400.849 84.0879Z" fill="#3B45FD"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M336.35 159.215C355.833 159.215 371.692 150.191 371.692 127.838V52.5742H355.149V65.8359C350.364 56.7441 342.503 51.3438 332.385 51.3438C314.27 51.3438 300.598 65.084 300.598 89.625C300.598 114.166 314.27 127.906 332.385 127.906C342.366 127.906 350.159 122.711 354.944 113.756V128.727C354.944 139.732 348.382 146.158 336.35 146.158C327.874 146.158 321.516 142.877 319.397 136.246H303.333C305.589 150.533 317.483 159.215 336.35 159.215ZM355.354 89.625C355.354 104.254 348.86 114.371 336.692 114.371C324.387 114.371 317.893 103.639 317.893 89.625C317.893 75.6113 324.387 65.3574 336.692 65.3574C348.86 65.3574 355.354 74.9961 355.354 89.625Z" fill="#3B45FD"/>
<path d="M188.828 99.7422C189.717 119.225 204.414 130.641 227.793 130.641C251.924 130.641 265.938 118.268 265.938 100.562C265.938 82.584 250.42 75.0645 236.27 71.5781L226.562 69.0488C218.564 66.998 208.789 63.5117 208.789 54.4883C208.789 46.3535 216.172 40.4062 228.066 40.4062C239.277 40.4062 247.002 45.6016 248.027 54.5566H264.57C264.092 37.877 249.736 25.7773 228.34 25.7773C207.354 25.7773 191.631 37.6719 191.631 55.4453C191.631 69.6641 201.611 78.209 218.428 82.6523L230.186 85.7969C241.123 88.668 248.984 92.0859 248.984 100.426C248.984 109.723 240.029 115.875 227.656 115.875C216.035 115.875 206.602 110.748 205.781 99.7422H188.828Z" fill="#3B45FD"/>
</svg>
`;

const SPLIT_BY_GRAPHEME_LOCALES = new Set([
  'ja',
  'ko',
  'zh-CN',
  'zh-Hant',
  'zh-HK',
]);

export async function generateDonationReceiptBlob(
  receipt: DonationReceipt,
  i18n: LocalizerType
): Promise<Blob> {
  const width = 2550;
  const height = 3300;
  const canvas = new fabric.StaticCanvas(null, {
    width,
    height,
    backgroundColor: COLORS.WHITE,
  });

  const fontFamily = 'Inter';

  // Fabric does word wrap on long strings (such as the footer text) by spaces, however
  // it doesn't work for languages without spaces such as Chinese. We use Fabric's
  // suggested workaround to use the splitByGrapheme option.
  const splitByGrapheme = SPLIT_BY_GRAPHEME_LOCALES.has(i18n.getLocale());

  const direction = i18n.getLocaleDirection();
  const isRTL = direction === 'rtl';
  const textAlignInlineStart = isRTL ? 'right' : 'left';

  const paddingTop = 70 * SCALING_FACTOR;
  const paddingX = 66 * SCALING_FACTOR;
  const contentWidth = width - paddingX * 2;
  const originXStart = isRTL ? 'right' : 'left';
  const originXEnd = isRTL ? 'left' : 'right';

  const leftInlineStart = isRTL ? width - paddingX : paddingX;
  const leftInlineEnd = isRTL ? paddingX : width - paddingX;

  let currentY = paddingTop;

  // Create an image from the SVG
  const logo = await new Promise<fabric.Image>((resolve, reject) => {
    const logoDataUrl = `data:image/svg+xml;base64,${btoa(SIGNAL_LOGO_SVG)}`;
    fabric.Image.fromURL(logoDataUrl, fabricImg => {
      if (!fabricImg) {
        reject(new Error('Failed to load logo'));
        return;
      }

      // Position the logo
      fabricImg.set({
        left: isRTL
          ? leftInlineStart - (fabricImg.width ?? 0)
          : leftInlineStart,
        top: currentY,
      });

      resolve(fabricImg);
    });
  });

  canvas.add(logo);

  const dateFormatter = getDateTimeFormatter({
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const dateStr = dateFormatter.format(new Date());
  const dateText = new fabric.Text(dateStr, {
    left: leftInlineEnd,
    top: currentY + (logo.height ?? 0),
    fontFamily,
    fill: COLORS.GRAY_60,
    direction,
    originX: originXEnd,
    originY: 'bottom',
    textAlign: textAlignInlineStart,
    ...scaleValues({ fontSize: 12 }),
  });
  canvas.add(dateText);

  currentY += (logo.height ?? 0) + 16 * SCALING_FACTOR;

  const divider1 = new fabric.Rect({
    left: paddingX,
    top: currentY,
    width: contentWidth,
    height: 1 * SCALING_FACTOR,
    fill: COLORS.GRAY_20,
  });
  canvas.add(divider1);
  strictAssert(divider1.height != null, 'Divider1 height must be defined');
  currentY += divider1.height;

  currentY += 167;
  const title = new fabric.Text(i18n('icu:DonationReceipt__title'), {
    left: leftInlineStart,
    top: currentY,
    fontFamily,
    fill: COLORS.GRAY_90,
    direction,
    originX: originXStart,
    textAlign: textAlignInlineStart,
    ...scaleValues({ fontSize: 20 }),
  });
  canvas.add(title);
  strictAssert(title.height != null, 'Title height must be defined');
  currentY += title.height + 29 * SCALING_FACTOR;

  // Amount section
  const amountLabel = new fabric.Text(
    i18n('icu:DonationReceipt__amount-label'),
    {
      left: leftInlineStart,
      top: currentY,
      fontFamily,
      fill: COLORS.GRAY_90,
      direction,
      originX: originXStart,
      textAlign: textAlignInlineStart,
      ...scaleValues({ fontSize: 14 }),
    }
  );
  canvas.add(amountLabel);

  const humanAmount = getHumanDonationAmount(receipt);
  const amountStr = toHumanCurrencyString({
    amount: humanAmount,
    currency: receipt.currencyType,
    showInsignificantFractionDigits: true,
  });
  const amountValue = new fabric.Text(amountStr, {
    left: leftInlineEnd,
    top: currentY,
    fontFamily,
    fill: COLORS.GRAY_90,
    direction,
    originX: originXEnd,
    ...scaleValues({ fontSize: 14 }),
  });
  canvas.add(amountValue);

  strictAssert(
    amountLabel.height != null,
    'Amount label height must be defined'
  );
  strictAssert(
    amountValue.height != null,
    'Amount value height must be defined'
  );
  currentY +=
    Math.max(amountLabel.height, amountValue.height) + 25 * SCALING_FACTOR;

  const boldDivider = new fabric.Rect({
    left: paddingX,
    top: currentY,
    width: contentWidth,
    height: 1 * SCALING_FACTOR,
    fill: COLORS.GRAY_90,
  });
  canvas.add(boldDivider);
  strictAssert(
    boldDivider.height != null,
    'Bold divider height must be defined'
  );
  currentY += boldDivider.height;

  // Details section (margin-top: 50px)
  currentY += 12 * SCALING_FACTOR;

  // Detail row 1 - Type (padding: 50px 0)
  currentY += 12 * SCALING_FACTOR;
  const typeLabel = new fabric.Text(i18n('icu:DonationReceipt__type-label'), {
    left: leftInlineStart,
    top: currentY,
    fontFamily,
    fill: COLORS.GRAY_95,
    direction,
    originX: originXStart,
    ...scaleValues({ fontSize: 14 }),
  });
  canvas.add(typeLabel);

  strictAssert(typeLabel.height != null, 'Type label height must be defined');
  currentY += 4 * SCALING_FACTOR + typeLabel.height; // margin-bottom + actual height
  const typeValue = new fabric.Text(
    i18n('icu:DonationReceipt__type-value--one-time'),
    {
      left: leftInlineStart,
      top: currentY,
      fontFamily,
      fill: COLORS.GRAY_45,
      direction,
      originX: originXStart,
      ...scaleValues({ fontSize: 12 }),
    }
  );
  canvas.add(typeValue);
  strictAssert(typeValue.height != null, 'Type value height must be defined');
  currentY += typeValue.height + 50; // actual height + bottom padding

  const rowDivider = new fabric.Rect({
    left: paddingX,
    top: currentY,
    width: contentWidth,
    height: 1 * SCALING_FACTOR,
    fill: COLORS.GRAY_20,
  });
  canvas.add(rowDivider);
  strictAssert(rowDivider.height != null, 'Row divider height must be defined');
  currentY += rowDivider.height;

  // Detail row 2 - Date Paid
  currentY += 12 * SCALING_FACTOR;
  const dateLabel = new fabric.Text(
    i18n('icu:DonationReceipt__date-paid-label'),
    {
      left: leftInlineStart,
      top: currentY,
      fontFamily,
      fill: COLORS.GRAY_95,
      direction,
      originX: originXStart,
      ...scaleValues({ fontSize: 14 }),
    }
  );
  canvas.add(dateLabel);

  strictAssert(dateLabel.height != null, 'Date label height must be defined');
  currentY += 4 * SCALING_FACTOR + dateLabel.height;
  const paymentDateFormatter = getDateTimeFormatter({
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const paymentDate = paymentDateFormatter.format(new Date(receipt.timestamp));
  const dateValue = new fabric.Text(paymentDate, {
    left: leftInlineStart,
    top: currentY,
    fontFamily,
    fill: COLORS.GRAY_45,
    direction,
    originX: originXStart,
    ...scaleValues({ fontSize: 12 }),
  });
  canvas.add(dateValue);
  strictAssert(dateValue.height != null, 'Date value height must be defined');
  currentY += dateValue.height + 50;

  currentY += 10 * SCALING_FACTOR;
  const footerText = i18n('icu:DonationReceipt__footer-text');

  const footer = new fabric.Textbox(footerText, {
    left: leftInlineStart,
    top: currentY,
    width: contentWidth,
    fontFamily,
    fill: COLORS.GRAY_60,
    lineHeight: 1.45,
    direction,
    originX: originXStart,
    splitByGrapheme,
    textAlign: textAlignInlineStart,
    ...scaleValues({ fontSize: 11 }),
  });
  canvas.add(footer);

  // Add staging indicator if in staging environment
  if (isStagingServer()) {
    strictAssert(footer.height != null, 'Footer height must be defined');
    currentY += footer.height + 100 * SCALING_FACTOR;

    const stagingText = new fabric.Text(
      'NOT A REAL RECEIPT / FOR TESTING ONLY',
      {
        left: width / 2,
        top: currentY,
        fontFamily,
        fontSize: 24 * SCALING_FACTOR,
        fontWeight: 'bold',
        fill: '#7C3AED',
        originX: 'center',
        textAlign: 'center',
      }
    );
    canvas.add(stagingText);
  }

  canvas.renderAll();

  // Convert canvas to PNG blob
  // First, get the canvas as a data URL (base64 encoded string)
  const dataURL = canvas.toDataURL({
    format: 'png',
    multiplier: 1,
  });

  // Extract the base64 encoded data from the data URL
  // Data URL format: "data:image/png;base64,iVBORw0KGgoAAAANS..."
  const base64Data = dataURL.split(',')[1];

  // Decode the base64 string to binary data
  const binaryString = atob(base64Data);

  // Convert the binary string directly to a typed array
  const byteArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    byteArray[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([byteArray], { type: 'image/png' });

  return blob;
}
