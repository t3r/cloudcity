import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';

import { CloudCityApi } from './cloud-city-api';
import { CloudCityDistribution } from  './cloud-city-distribution';

export interface CloudCityUiProps {
  tilesTable: dynamodb.TableV2,
  certificateArn:  string,
  domainName: string,
}

export class CloudCityUi extends Construct {
  public readonly o2cBucket: s3.IBucket;
  constructor(scope: Construct, id: string, props: CloudCityUiProps) {
    super(scope, id);

    const { api,websocketApi, userPool } = new CloudCityApi( this, 'Api', {
      tilesTable: props.tilesTable
    });

    const { distribution, o2cBucket } = new CloudCityDistribution( this, 'Distribution', {
      domainName: props.domainName,
      domainNameCertificateArn: props.certificateArn,
      api,
      websocketApi,
      userPool
    });
    this.o2cBucket = o2cBucket;

    new cdk.CfnOutput(this, 'DistributionOut', {
      description: 'CloudCity CloudFront distribution DNS Name.  Use this to configure your DNS to point to this distribution.',
      value: distribution.domainName
    });
  }
};



