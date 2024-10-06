
import { DbAccess } from './dbaccess.mjs';

function groupTilesByStatus(items) {
    return items.reduce((acc, item) => {
        // If the status doesn't exist as a key yet, create an empty array for it
        if (!acc[item.status]) {
            acc[item.status] = [];
        }

        // Push the tile to the array for this status
        acc[item.status].push(item.tile);

        return acc;
    }, {});
}

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
            const response = groupTilesByStatus(body.Items);
            console.log(`LEAVE getOneOne(${oneone}): ${JSON.stringify(response)}`);
            return response;
        } else {
            throw new Error('invalid oneone format');
        }
    }
    async rebuildOneOne( oneone ) {
        throw new Error('not implemented: rebuildOneOne', tileInde )
    }

    async getTenTen( tenten ) {
        console.log(`ENTER getTenTen(${tenten})`);
        if( tenten.match(TileController.tentenregex) ) {
            const body = await this.db.getTilesFor10x10( tenten );
            const response = groupTilesByStatus(body.Items);
            return response;
        } else {
          throw new Error('invalid tenten format');
        }
    }

    async rebuildTenTen( tenten ) {
        throw new Error('not implemented: rebuildTenTen', tileInde)
    }

    async getTenTenStats( tenten ) {
        console.log(`ENTER getTenTenStats(${tenten})`);
        const response = {
            tenten,
            stats: {},
        };
        const st = await this.getTenTen(tenten);
        for (const [status, tiles] of Object.entries(st)) {
            response.stats[status] = tiles.length;
        }
        console.log(`LEAVE: getTenTenStats(${tenten}): ${JSON.stringify(response)}`);
        return response;
    }

    async getOneOneStats(tenten) {
        console.log(`ENTER getOneOneStats(${tenten})`);
        const response = {
            tenten,
            stats: {},
        };
        const st = await this.getOneOne(tenten);
        for (const [status, tiles] of Object.entries(st)) {
            response.stats[status] = tiles.length;
        }
        console.log(`LEAVE: getOneOneStats(${tenten}): ${JSON.stringify(response)}`);
        return response;
    }
}
/*
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const test = async () => {
    try {
        const client = new DynamoDBClient({
            region: process.env.AWS_REGION || "eu-central-1",
        });

        const documentClient = DynamoDBDocument.from(client);
        const tc = new TileController({
            tilesTableName: process.env.TABLE_NAME,
            documentClient,
        });

        let x;
        // x = await tc.getTenTen("w080n40");
        // console.log("tenten", x);

        // x = await tc.getOneOne("w070n80");
        // console.log("oneone", x);

        // x = await tc.getOneOne("e000n01");
        // console.log("oneone - no match", x);

        x = await tc.getOneOneStats("w080n40");
        console.log("tentenstats", x);



        // x = await tc.getTile(1728611);
        // console.log("byid", x);
    } catch (e) {
        console.log(e);
    }
}
test();
*/
