import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const apigatewaymanagementapi = new ApiGatewayManagementApiClient({
    endpoint: process.env.API_GATEWAY_ENDPOINT,
});

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
});

const documentClient = DynamoDBDocument.from(client);

const tableName = process.env.CONNECTIONS_TABLE || 'CloudCityWSConnections';

export const handler = async (event) => {

  // make sure there is at least one record to send
  if( ! event.Records ) {
    console.error('No records in event');
    return;
  }

  // grab dynamodb events and
  // map to an plain javascript object
  const records = event
                    .Records
                    .filter( r => r.eventSource === 'aws:dynamodb')
                    .map( r => { return {
                      event: r.eventName,
                      item: unmarshall(
                      r.eventName === 'REMOVE' ?
                        r.dynamodb.OldImage :
                        r.dynamodb.NewImage
                      ),
                    }});
  if( ! records.length ) {
    console.error('No DynamoDB records in event');
    return;
  }

  // now scan for connection ids
  const doc = await documentClient.scan({
    TableName: tableName,
  })

  // build the promises for each clientId
  const proms = doc.Items.map(i => {
    return apigatewaymanagementapi.send(new PostToConnectionCommand({
        ConnectionId: i.ConnectionId,
        Data: Buffer.from(JSON.stringify(records))
    }));
  });

  // and wait for all of them to complete
  try {
    await Promise.all(proms);
    console.log(`${records.length} Messages sent to ${proms.length} clients`);
    return {
        statusCode: 200,
        body: JSON.stringify({status: 'OK'})
    };
  } catch (err) {
    console.error('Failed to send messages:', err);
    return {
        statusCode: 500,
        body: JSON.stringify({status:'Error', error: err })
    };
  }
};
