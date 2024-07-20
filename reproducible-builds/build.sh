#!/bin/sh

docker build -t signal-desktop --build-arg NODE_VERSION=$(cat ../.nvmrc) .
cd ..
docker run --rm -v "$(pwd)":/project -w /project --user "$(id -u):$(id -g)" signal-desktop sh -c "npm install; npm run generate; npm run build-release" 
