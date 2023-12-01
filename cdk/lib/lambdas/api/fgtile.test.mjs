// https://wiki.flightgear.org/Tile_Index_Scheme

import * as tile from './fgtile.mjs';

test('tile.tileWidth', () => {
  expect(tile.tileWidth(89)).toBe(12);
  expect(tile.tileWidth(89-1e-12)).toBe(4);

  expect(tile.tileWidth(86)).toBe(4);
  expect(tile.tileWidth(86-1e-12)).toBe(2);

  expect(tile.tileWidth(83)).toBe(2);
  expect(tile.tileWidth(83-1e-12)).toBe(1);

  expect(tile.tileWidth(76)).toBe(1);
  expect(tile.tileWidth(76-1e-12)).toBe(0.5);

  expect(tile.tileWidth(62)).toBe(0.5);
  expect(tile.tileWidth(62-1e-12)).toBe(0.25);

  expect(tile.tileWidth(22)).toBe(0.25);
  expect(tile.tileWidth(22-1e-12)).toBe(0.125);

  expect(tile.tileWidth(-22+1e-12)).toBe(0.125);
  expect(tile.tileWidth(-22)).toBe(0.25);

  expect(tile.tileWidth(-62+1e-12)).toBe(0.25);
  expect(tile.tileWidth(-62)).toBe(0.5);

  expect(tile.tileWidth(-76+1e-12)).toBe(0.5);
  expect(tile.tileWidth(-76)).toBe(1);

  expect(tile.tileWidth(-83+1e-12)).toBe(1);
  expect(tile.tileWidth(-83)).toBe(2);

  expect(tile.tileWidth(-86+1e-12)).toBe(2);
  expect(tile.tileWidth(-86)).toBe(4);

  expect(tile.tileWidth(-89+1e-12)).toBe(4);
  expect(tile.tileWidth(-89)).toBe(12);
});

test('tile.tileWidth - out of bounds resiliance', () => {
  expect(tile.tileWidth(100)).toBe(12);
  expect(tile.tileWidth(-100)).toBe(12);
});

test('tileCoords - random positions', () => {
  let pos = {lat:53.5,lon:10.1};
  let c = tile.getTileBounds(tile.getTileIdx(pos));
  expect(pos.lat).toBeGreaterThanOrEqual(c.s);
  expect(pos.lat).toBeLessThan(c.n);
  expect(pos.lon).toBeGreaterThanOrEqual(c.w);
  expect(pos.lon).toBeLessThan(c.e);

  pos = {lat:-53.5,lon:-10.0};
  c = tile.getTileBounds(tile.getTileIdx(pos));
  expect(pos.lat).toBeGreaterThanOrEqual(c.s);
  expect(pos.lat).toBeLessThan(c.n);
  expect(pos.lon).toBeGreaterThanOrEqual(c.w);
  expect(pos.lon).toBeLessThan(c.e);
});

test('tileIndex - random tiles', () => {
  expect(tile.getTileIdx({lat:53.5,lon:10.1})).toBe(3122144);
  expect(tile.getTileIdx({lat:51.25,lon:-.3})).toBe(2941778);
  expect(tile.getTileIdx({lat:-52.07,lon:-70.37})).toBe(1788282);

  expect(tile.getTileIdx({lat:0,lon:0})).toBe(2954880);
  expect(tile.getTileIdx({lat:-1e-12,lon:0})).toBe(2954872);
  expect(tile.getTileIdx({lat:-1e-12,lon:-1e-12})).toBe(2938495);

  expect(tile.getTileIdx({lat:0,lon:-180})).toBe(90 * 2**6);
});

test('tile.getTiles - 1x1', () => {
  const t = tile.getTiles({ w:-180,s:-10,e:-179,n:-9});
  expect(t).toHaveLength(8 / tile.tileWidth(-10));
});

test('tile.getTileFolder()', () => {
  let t = tile.getTileIdx({lat:53.5,lon:10.1});
  expect(tile.getTileFolder(t,1)).toBe('e010n53');
  expect(tile.getTileFolder(t,10)).toBe('e010n50');

  t = tile.getTileIdx({lat:0, lon:0});
  expect(tile.getTileFolder(t,1)).toBe('e000n00');
  expect(tile.getTileFolder(t,10)).toBe('e000n00');

  t = tile.getTileIdx({lat:0,lon:-180});
  expect(tile.getTileFolder(t,1)).toBe('w180n00');
  expect(tile.getTileFolder(t,10)).toBe('w180n00');
});

test('tile.getTilesInFolder', () => {
  const tiles = tile.getTilesInFolder('e000n00', 1);
  expect(tiles).toHaveLength(8 / tile.tileWidth(0));
})
