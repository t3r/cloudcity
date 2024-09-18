ARG PLATFORM=amd64

FROM debian:bookworm AS osm2city-installer
RUN export DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true && \
  apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  git

## cd osm2city; for patch in ../patches/osm2city/*.patch; do git am $patch; done; cd ..

WORKDIR /app
COPY patches patches
RUN git config --global user.email "osm2city-patcher@flightgear.org" && \
    git config --global user.name "osm2city patcher" && \
    git clone https://gitlab.com/t3r/osm2city.git && \
    git clone https://gitlab.com/osm2city/osm2city-data.git && \
    rm -rf osm2city/.git && \
    rm -rf osm2city-data/.git && \
    chown 1000:1000 /app -R

FROM torstend/fgelev:latest-${PLATFORM}
USER root
RUN export DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true && \
  apt-get update && apt-get install -y --no-install-recommends \
  bc \
  curl \
  jq \
  parallel \
  python3 python3-pip \
  xz-utils \
  && apt-get clean && \
  groupadd -g 1000 appuser && \
  useradd -u 1000 -g 1000 -m appuser --home-dir /app

COPY ./scripts /app/scripts

COPY --from=osm2city-installer /app/osm2city /app/osm2city
COPY --from=osm2city-installer /app/osm2city-data /app/osm2city-data

USER appuser
WORKDIR /app

COPY requirements.txt .
RUN /usr/bin/pip install -r requirements.txt --break-system-packages

RUN mkdir -p scenery && \
    mkdir -p fg_root && \
    chown appuser:appuser /app/scenery /app/fg_root 

COPY params.ini /app/params.ini

VOLUME /app/scenery
VOLUME /app/fg_root
ENV FG_ROOT=/app/fg_root

ENTRYPOINT [ "/bin/bash" ]

