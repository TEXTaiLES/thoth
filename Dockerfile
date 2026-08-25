FROM node:24

RUN apt-get update && apt-get install -y git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm
RUN npm install -g pm2

# 1. Fetch the verified ATON revision
ARG ATON_COMMIT=5a7582d7c92d44066f50feddcb3576ed1027d32e
RUN git init /aton \
    && git -C /aton remote add origin https://github.com/phoenixbf/aton.git \
    && git -C /aton fetch --depth 1 origin "${ATON_COMMIT}" \
    && git -C /aton checkout --detach FETCH_HEAD \
    && test "$(git -C /aton rev-parse HEAD)" = "${ATON_COMMIT}"
WORKDIR /aton

# 2. Install ATON dependencies
RUN npm install

# 3. Copy thoth items into ATON wapps as THOTH
RUN mkdir -p /aton/wapps/thoth
COPY . /aton/wapps/thoth

# 3a. Build the exact-geodesic N-API addon. Keep a copy outside the wapp
# directory so docker-compose.dev.yml can bind-mount source without hiding it.
WORKDIR /aton/wapps/thoth/geodesic/geodesic_addon
RUN npm ci --omit=dev \
    && cp build/Release/geodesic_addon.node /aton/services/thoth-geodesic-addon.node \
    && node -e "require('/aton/services/thoth-geodesic-addon.node')"
ENV THOTH_GEODESIC_ADDON_PATH=/aton/services/thoth-geodesic-addon.node

# 3b. Install the THOTH same-origin gateway hook into this private image copy.
# This never edits the host ATON checkout.
RUN node /aton/wapps/thoth/server/deployment/install-gateway.cjs /aton/services/ATON.service.main.js

# 4. Run ATON
WORKDIR /aton
CMD ["pm2-runtime", "ecosystem.config.js"]
