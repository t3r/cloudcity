import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {  DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
});

const documentClient = DynamoDBDocument.from(client);

const connectionsTableName = process.env.CONNECTIONS_TABLE || 'CloudCityWSConnections';
const tilesTableName = process.env.TILES_TABLE || 'CloudCityTiles';


import { TileController } from './tileController.mjs';

const tileController = new TileController({
  tilesTableName, documentClient
});

export const handler = async (event) => {
  console.log("Handling event", event)
  const connectionId = event.requestContext.connectionId;
  let response;

  try {
    switch( event.requestContext.routeKey) {
      case '$connect':
        await addConnectionId(connectionId)
        break;

      case '$disconnect':
        await removeConnectionId(connectionId)
        break;

      case '$default':
        const b = event.isBase64Encoded ?
                  Buffer.from( event.body, 'base64').toString('utf-8') :
                  event.body;
        response = await handleDefault(JSON.parse(b));
        console.log("response is", response);
        break;
    }
    return {
      statusCode: 200,
      body: response ? JSON.stringify(response) : undefined,
    }
  }
  catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    }
  }
}

const addConnectionId = (connectionId) => {
  return documentClient.put({
    TableName: connectionsTableName,
      Item: {
      ConnectionId : connectionId
    },
  });
}

const removeConnectionId = (connectionId) => {
  return documentClient.delete({
    TableName: connectionsTableName,
    Key: {
      ConnectionId : connectionId,
    },
  })
}

const  handleDefault = async (body ) => {
  switch( body.action ) {
    case 'getTenTenStats':
      return tileController.getTenTenStats(body.key)

      case 'getTenTen':
      return tileController.getTenTen( body.key )

    case 'rebuildTenTen':
      return tileController.rebuildTenTen( body.key )

    case 'getOneOne':
      return tileController.getOneOne( body.key )

    case 'getOneOneStats':
      return tileController.getOneOneStats(body.key)

    case 'rebuildOneOne':
        return tileController.rebuildOneOne( body.key )

    case 'getTile':
      return tileController.getTile( body.key )

    case 'rebuildTile':
      return tileController.rebuildTile( body.key )

    default:
      throw new Error(`Invalid action ${body.action}`);
  }
}






