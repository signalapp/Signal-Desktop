FROM ubuntu:16.04
MAINTAINER Krish <K.DeSouza@Outlook.com>
WORKDIR /app
RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

RUN apt-get update && apt-get install -y curl build-essential snapcraft git &&\
    curl -sL https://deb.nodesource.com/setup_8.x | bash - &&\
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add &&\
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list &&\
    apt-get update && apt-get install -y nodejs yarn
RUN rm /bin/sh && ln -s /bin/bash /bin/sh
RUN npm install -g grunt-cli
COPY package.json /app
COPY yarn.lock /app
RUN yarn install --verbose
ADD . /app
ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
RUN grunt
RUN yarn icon-gen
RUN mkdir release/Linux
ENTRYPOINT ["sh","Signal_Docker_Image/entry_point.sh"]
