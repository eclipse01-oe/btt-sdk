FROM node:20

WORKDIR /app

COPY package*.json ./

RUN apt-get update && apt-get install -y libvips-dev
ENV ONNXRUNTIME_NODE_INSTALL=skip

RUN npm install

RUN npx playwright install --with-deps chromium

RUN apt-get update && apt-get install -y \
  xvfb \
  libnss3 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libxss1 \
  libasound2

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]