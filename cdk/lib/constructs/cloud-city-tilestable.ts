import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface CloudCityTilesTableProps {
}

export class CloudCityTilesTable extends Construct {
  public readonly table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props?: CloudCityTilesTableProps ) {
    super(scope, id);

    // DDB table to store tile states
    this.table = new dynamodb.TableV2(this, id, {
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: { name: 'tile', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      dynamoStream: dynamodb.StreamViewType.NEW_IMAGE, // Enable DynamoDB Stream
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi_10x10',
      partitionKey: { name: 'ten_ten', type: dynamodb.AttributeType.STRING },
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi_1x1',
      partitionKey: { name: 'one_one', type: dynamodb.AttributeType.STRING },
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi_status',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

  }
}
