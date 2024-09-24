#!/bin/bash
set -euxo pipefail

function cleanup {
  echo "cleanup"
}

function term {
  echo "SIGTERM received. The end is near."
}

trap cleanup EXIT
trap term SIGTERM

WEST=
EAST=
SOUTH=
NORTH=
DATABASE=
JSON=
TEN=
ONE=
TILE=
PINI=

usage() { 
  echo "Usage: $0 --input something.osm.pbf [--database dbname] [--east -120  --west -130 --south 30 --north 40]" 1>&2; 
  echo "Short usage: $0 -i something.osm.pbf [-d dbname] [-e -120  -w -130 -s 30 -n 40]" 1>&2; exit 1; 
}

# Transform long options to short ones
for arg in "$@"; do
  shift
  case "$arg" in
    '--input')   set -- "$@" '-i'   ;;
    '--database')   set -- "$@" '-d'   ;;
    '--east')   set -- "$@" '-e'   ;;
    '--west')   set -- "$@" '-w'   ;;
    '--south')   set -- "$@" '-s'   ;;
    '--north')   set -- "$@" '-n'   ;;
    '--json')   set -- "$@" '-j'   ;;
    '--10x10')   set -- "$@" '-t'   ;;
    '--1x1')     set -- "$@" '-o'   ;;
    '--tile')    set -- "$@" '-l'   ;;
    '--pini')    set -- "$@" '-p'   ;;
    '--help')   set -- "$@" '-h'   ;;
    *) set -- "$@" "$arg" ;;
  esac
done

# Parse short options
OPTIND=1
while getopts "i:j:d:e:w:s:n:t:o:l:p:h" opt
do
  case "$opt" in
    'd') DATABASE=$OPTARG ;;
    'e') EAST=$OPTARG ;;
    'w') WEST=$OPTARG ;;
    's') SOUTH=$OPTARG ;;
    'n') NORTH=$OPTARG ;;
    'j') JSON=$OPTARG ;;
    't') TEN=$OPTARG ;;
    'o') ONE=$OPTARG ;;
    'l') TILE=$OPTARG ;;
    'p') PINI=$OPTARG ;;
    'h') usage ;;
    '?') usage ;;
  esac
done
shift $(expr $OPTIND - 1) # remove options from positional parameters
. $(dirname $0)/boundsparser.sh
test -n "$DATABASE" && export PGDATABASE=$DATABASE
O2C_PROCESSES=${O2C_PROCESSES:-1}

# if provided, append base64 encoded params.ini content to the default params.ini
cat /app/params.ini > /tmp/params.ini
if [ ! -z "$PINI" ]; then
  echo $PINI | base64 -d >> /tmp/params.ini
fi

echo "Using params.ini:"
cat /tmp/params.ini

/usr/bin/python3 /app/osm2city/build_tiles.py -f /tmp/params.ini -p ${O2C_PROCESSES} -b "*${WEST}_${SOUTH}_${EAST}_${NORTH}"

