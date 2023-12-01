export const tileWidth = (lat) => {
  return [
    [ 89, 12 ],
    [ 86, 4],
    [ 83, 2],
    [ 76, 1],
    [ 62, 1/2 ],
    [ 22, 1/4],
    [ -1, 1/8 ]].find( (e) => e[0] <= Math.abs(lat) )[1];
}

export const getTileIdx = ( coords ) => {
  const base_y    = Math.floor(coords.lat);
  const y         = Math.trunc((coords.lat-base_y)*8);
  const w         = tileWidth(coords.lat);
  const base_x    = Math.max( -180, Math.floor(Math.floor( coords.lon / w )* w ) );
  const x         = Math.trunc(Math.floor((coords.lon-base_x)/w));
  const tile      = Math.trunc(((Math.trunc(Math.floor(coords.lon))+180)<<14) + ((Math.trunc(Math.floor(coords.lat))+ 90) << 6) + (y << 3) + x);
  return tile;
}

export const getTileBounds = (tile) => {
  const x = (tile >> 0) & 0x07;
  const y = (tile >> 3) & 0x07;
  const lat = (((tile >> 6) & 0xff) - 90.0) + 0.125*y;
  const lon = ((tile >> 14)) - 180.0;
  const c = {
    s: lat,
    n: lat + 0.125,
    w: lon + x * tileWidth(lat),
    e: lon + (x+1) * tileWidth(lat),
  }
  c.centerLatitude = (c.n + c.s)/2;
  c.centerLongitude = (c.e + c.w)/2;
  return c;
}

export const getTiles = ( bounds ) => {
  const tiles = [];
  for( let lat = Math.floor(bounds.s); lat < Math.ceil(bounds.n); lat += 1/8 ) {
    const w = tileWidth( lat );
    for( let lon = Math.floor(bounds.w); lon < Math.ceil(bounds.e); lon += w ) {
      tiles.push( {s:lat, w:lon, n:lat+1/8, e:lon+w, idx:getTileIdx({lat,lon})} );
    }
  }
  return tiles;
}

export const getTilesInFolder = ( folder, scale ) => {
  scale = scale || 1;
  const m = folder.match(/(e|w)(\d+)(n|s)(\d+)/);
  const ew = m[1];
  let o = parseInt(m[2]);
  const ns = m[3];
  let n = parseInt(m[4]);

  o = ew === "e" ? o : -o;
  n = ns === "n" ? n : -n;

  return getTiles({
    s: n,
    w: o,
    n: n + scale,
    e: o + scale
  });
}

export const getTileFolder = (tileIndex, scale ) => {
  scale = scale || 1;
  const bounds = getTileBounds(tileIndex);
  let o = Math.floor( bounds.centerLongitude/scale ) * scale;
  let ew = "e"
  if( o < 0 ) {
    ew = "w"
    o = -o
  }
  let n = Math.floor( bounds.centerLatitude/scale ) * scale;
  let ns = "n"
  if( n < 0 ) {
    n = -n
    ns = "s"
  }
  return `${ew}${String(o).padStart(3,'0')}${ns}${String(n).padStart(2,'0')}`
}


