
import { DbAccess } from './dbaccess.mjs';

export class TileController {
    static oneoneregex = /^[ew][01]\d{2}[ns]\d{2}$/
    static tentenregex = /^[ew][01]\d0[ns]\d0$/

    constructor( props ) {
        this.db = new DbAccess( props );
    }

    async getTile( tileIndex ) {
        console.log(`ENTER getTile(${tileIndex})`);
        const body = await this.db.getTileById( Number(tileIndex) );
        console.log(`LEAVE getTile(${tileIndex}): ${JSON.stringify(body)}`);
        return body.Items[0];
    }

    async rebuildTile( tileIndex ) {
        console.log(`ENTER rebuildTile(${tileIndex})`);
        const body = await this.db.updateTile( Number(tileIndex), 'rebuild' );
        console.log(`LEAVE rebuildTile(${tileIndex}): ${JSON.stringify(body)}`);
        return {};
    }

    async getOneOne( oneone ) {
        console.log(`ENTER getOneOne(${oneone})`);
        if( oneone.match(TileController.oneoneregex) ) {
            const body = await this.db.getTilesFor1x1( oneone );
            console.log(`LEAVE getOneOne(${oneone}): ${JSON.stringify(body)}`);
            return body.Items;
        } else {
            throw new Error('invalid oneone format');
        }
    }
    async rebuildOneOne( oneone ) {
        throw new Error('not implemented: rebuildOneOne', tileInde )
    }

    async getTenTen( tenten ) {
        console.log(`ENTER getTileByTen(${tenten})`);
        if( tenten.match(TileController.tentenregex) ) {
          const body = await this.db.getTilesFor10x10( tenten );
          console.log(`LEAVE getTileByTen(${tenten}): ${JSON.stringify(body)}`);
          return body.Items;
        } else {
          throw new Error('invalid tenten format');
        }
    }

    async rebuildTenTen( tenten ) {
        throw new Error('not implemented: rebuildTenTen', tileInde)
    }
}
