import { getTileFolder } from "./fgtile.mjs"

export class DbAccess {
  constructor(props) {
        this.tableName = props.tilesTableName;
        this.documentClient = props.documentClient;
  }

  getTileById = async( tile ) => {
    return this.documentClient.query(
      {
        TableName: this.tableName,
        KeyConditionExpression: "#tile = :tile",
        ExpressionAttributeNames: {
          "#tile": "tile",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":tile": tile,
        },
        ProjectionExpression: "#tile, #status",
        Limit: 1,
        ScanIndexForward: false,
      }
    );
  }

  updateTile = ( tile, status ) => {
    return this.documentClient.update({
      TableName: this.tableName,
      Key: {
        "tile": Number(tile),
        "timestamp": 1,
      },
      UpdateExpression: "SET #status = :status, #one_one = :one_one, #ten_ten = :ten_ten",
      ExpressionAttributeNames: {
        "#status": "status",
        "#one_one": "one_one",
        "#ten_ten": "ten_ten",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":one_one": getTileFolder(tile,1),
        ":ten_ten": getTileFolder(tile, 10),
      },
    });
  }

  updateTileById = async( tileOrTiles, body ) => {

    const status = body.status;
    if( Array.isArray(tileOrTiles) ) {
      return Promise.all( tileOrTiles.map( t => updateTile(t, status) ) );
    } else {
      return updateTile(tileOrTiles, status);
    }
  }

  getTilesFor1x1 = async( one_one ) => {
    console.log("getTilesFor1x1",one_one);
    return this.documentClient.query(
      {
        TableName: this.tableName,
        IndexName: "gsi_1x1",
        KeyConditionExpression: "#one_one = :v_one_one",
        ExpressionAttributeNames: {
          "#tile": "tile",
          "#one_one": "one_one",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":v_one_one": one_one,
        },
        ProjectionExpression: "#tile, #status",
      }
    );
  }

  getTilesFor10x10 = async( ten_ten ) => {
    console.log("getTilesFor10x10",ten_ten);
    return await this.documentClient.query(
      {
        TableName: this.tableName,
        IndexName: "gsi_10x10",
        KeyConditionExpression: "#ten_ten = :v_ten_ten",
        ExpressionAttributeNames: {
          "#tile": "tile",
          "#ten_ten": "ten_ten",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":v_ten_ten": ten_ten,
        },
        ProjectionExpression: "#tile, #status",
      }
    );
  }

}

/*
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
const test = async() => {
  try {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || "eu-central-1",
    });

    const documentClient = DynamoDBDocument.from(client);
    const db = new DbAccess({
      tilesTableName: process.env.TABLE_NAME,
      documentClient,
    });
    let x
    // x = await updateTileById(3122144, { status: "rebuild", } )
    // console.log("updatebytile: ",x);

    // x = await updateTileById([3122160,3122144], { status: "rebuild", } )
    // console.log("updatebytiles: ",x);


    x = await db.getTilesFor10x10( "w080n40" );
    console.log("tenten",x);

    x = await db.getTilesFor1x1( "w070n80" );
    console.log("oneone",x);

    x = await db.getTilesFor1x1( "e000n01" );
    console.log("oneone - no match",x);



    x = await db.getTileById( 1728611 );
    console.log("byid",x);
  }catch(e) {
    console.log(e);
  }
}
test();
*/
