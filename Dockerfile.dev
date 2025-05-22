# Build-time stage
FROM node:16-slim AS build

RUN mkdir -p /home/node/app && chown node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node package.json ./

RUN yarn install

COPY --chown=node:node . .

RUN yarn build \
  && yarn apidoc

# Run-time stage
FROM node:16-slim

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
# hadolint ignore=DL3008,DL3015
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 libxshmfence1\
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/* && mkdir -p /home/node/app && chown node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node package.json ./

# RUN npm ci --only=production && npm install pm2 -g
RUN yarn 

# ENV PORT=
# ENV DB_URL="mongodb://host.docker.internal/tin-service"
# ENV REDIS_URL="redis://host.docker.internal:6379"

COPY --chown=node:node --from=build /home/node/app/dist ./dist
COPY --chown=node:node --from=build /home/node/app/docs ./docs

EXPOSE 30112

# CMD ["pm2-runtime", "start", "ecosystem.config.js"]
CMD ["node", "dist/main.js"]
