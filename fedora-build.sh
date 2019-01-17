#!/usr/bin/env bash
yarn install --frozen-lockfile
yarn grunt
yarn icon-gen
yarn test
yarn generate
yarn build-release
