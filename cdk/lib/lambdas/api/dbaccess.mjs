import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getTileFolder } from "./fgtile.mjs"
import {
  DynamoDBDocument,
} from "@aws-sdk/lib-dynamodb";

const tableName = process.env.TABLE_NAME || "CloudCity";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
});

const documentClient = DynamoDBDocument.from(client);

//FIXME add cache

export const db_getTileById = async( tile ) => {
  return documentClient.query(
    {
      TableName: tableName,
      KeyConditionExpression: "#tile = :tile",
      ExpressionAttributeNames: {
        "#tile": "tile",
      },
      ExpressionAttributeValues: {
        ":tile": tile,
      },
      Limit: 1,
      ScanIndexForward: false,
    }
  );
}

const updateTile = ( tile, status ) => {
  return documentClient.update({
    TableName: tableName,
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
export const db_updateTileById = async( tileOrTiles, body ) => {

  const status = body.status;
  if( Array.isArray(tileOrTiles) ) {
    return Promise.all( tileOrTiles.map( t => updateTile(t, status) ) );
  } else {
    return updateTile(tileOrTiles, status);
  }
}

export const db_getTilesFor1x1 = async( one_one ) => {
  console.log("getTilesFor1x1",one_one);
  return documentClient.query(
    {
      TableName: tableName,
      IndexName: "gsi_1x1",
      KeyConditionExpression: "#one_one = :v_one_one",
      ExpressionAttributeNames: {
        "#one_one": "one_one",
      },
      ExpressionAttributeValues: {
        ":v_one_one": one_one,
      },
    }
  );
}

export const db_getTilesFor10x10 = async( ten_ten ) => {
  console.log("getTilesFor10x10",ten_ten);
  return await documentClient.query(
    {
      TableName: tableName,
      IndexName: "gsi_10x10",
      KeyConditionExpression: "#ten_ten = :v_ten_ten",
      ExpressionAttributeNames: {
        "#ten_ten": "ten_ten",
      },
      ExpressionAttributeValues: {
        ":v_ten_ten": ten_ten,
      },
    }
  );
}

/* 
const test = async() => {
  try {
    let x 
    x = await db_updateTileById(3122144, { status: "rebuild", } )
    console.log("updatebytile: ",x);

    x = await db_updateTileById([3122160,3122144], { status: "rebuild", } )
    console.log("updatebytiles: ",x);


    x = await db_getTilesFor10x10( "w110n20" );
    console.log("tenten",x);

    x = await db_getTilesFor1x1( "e010n53" );
    console.log("oneone",x);

    x = await db_getTilesFor1x1( "e009n54" );
    console.log("oneone - no match",x);

    

    x = await db_getTileById( 3122144 );
    console.log("byid",x);
  }catch(e) {
    console.log(e);
  }
}
test();
*/
