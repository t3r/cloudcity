export function tileWidth(lat: number): number {
    lat = Math.abs(lat);
    if (lat < 22) return 1.0 / 8.0;
    if (lat < 62) return 1.0 / 4.0;
    if (lat < 76) return 1.0 / 2.0;
    if (lat < 83) return 1.0 / 1.0;
    if (lat < 86) return 2.0 / 1.0;
    if (lat < 88) return 4.0 / 1.0;
    if (lat < 89) return 8.0 / 1.0;
    return 360.0;
}
export interface TileBounds {
    s: number;
    n: number;
    w: number;
    e: number;
}
export const getTileBounds = (tile: number): TileBounds => {
    const x = (tile >> 0) & 0x07;
    const y = (tile >> 3) & 0x07;
    const lat = (((tile >> 6) & 0xff) - 90.0) + 0.125 * y;
    const lon = ((tile >> 14)) - 180.0;
    const c = {
        s: lat,
        n: lat + 0.125,
        w: lon + x * tileWidth(lat),
        e: lon + (x + 1) * tileWidth(lat),
    }
    return c;
}

export function tileIndexFromCoordinate(lat: number, lon: number): number {
    var base_y = Math.floor(lat);
    var y = Math.trunc((lat - base_y) * 8);
    var tilewidth = tileWidth(lat);
    var base_x = Math.floor(Math.floor(lon / tilewidth) * tilewidth);
    if (base_x < -180) {
        base_x = -180;
    };
    var x = Math.trunc(Math.floor((lon - base_x) / tilewidth));
    var tile = Math.trunc(((Math.trunc(Math.floor(lon)) + 180) << 14) + ((Math.trunc(Math.floor(lat)) + 90) << 6) + (y << 3) + x);
    return tile;
}

export function getDirFromCoordinate(lat: number, lon: number, scale: number): string {
    const paddedSignedValue = ( val: number, signs: string[], width: number, scale: number ) => {
        let sign = signs[0];
        val = Math.floor(val/scale)*scale;
        if( val < 0 ) {
            val *= -1;
            sign = signs[1];
        }
        const paddedVal = val.toString().padStart(width, '0');
        return [sign, paddedVal];
    }
    let lonVal = paddedSignedValue(lon, ['e', 'w'], 3, scale);
    let latVal = paddedSignedValue(lat, ['n', 's'], 2, scale );
    return `${lonVal[0]}${lonVal[1]}${latVal[0]}${latVal[1]}`;
}