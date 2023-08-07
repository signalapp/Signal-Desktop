/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');

const sass = require('sass'); // Prefer `dart-sass`

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  output: {
    path: path.resolve(__dirname, 'stylesheets', 'dist'),
  },
  entry: './stylesheets/manifest.scss',
  mode: 'production',

  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `main.css` compiling all of the compiled css files
          MiniCssExtractPlugin.loader,
          // Translates CSS into CommonJS
          'css-loader',
          // Compiles Sass to CSS
          {
            loader: 'sass-loader',
            options: {
              implementation: sass,
            },
          },
        ],
      },
    ],
  },
  plugins: [].concat(
    new MiniCssExtractPlugin({
      filename: 'manifest.css',
    })
  ),
};
