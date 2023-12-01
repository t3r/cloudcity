import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';

import { CloudCityApi } from './cloud-city-api';
import { CloudCityDistribution } from  './cloud-city-distribution';

export interface CloudCityUiProps {
  tilesTable: dynamodb.TableV2,
}

export class CloudCityUi extends Construct {
  public readonly o2cBucket: s3.IBucket;
  constructor(scope: Construct, id: string, props: CloudCityUiProps) {
    super(scope, id);

    const domainParameter = new cdk.CfnParameter(this, 'DomainName', {
      type: 'String',
      description: 'Alternate domain name to use for the site (requires a certificate)',
      default: 'cloudcity.flightgear.org'
    });

    const certParameter = new cdk.CfnParameter( this, 'DomainCertificate', {
      type: 'String',
      description: 'Domain certificate ARN',
      default: 'arn:aws:acm:us-east-1:533267260386:certificate/8e3e7731-f21e-4e72-b17a-6c137a95ad74',
    });

    const { api,websocketApi, userPool } = new CloudCityApi( this, 'Api', { 
      tilesTable: props.tilesTable
    });
    const { distribution, o2cBucket } = new CloudCityDistribution( this, 'Distribution', {
      domainName: domainParameter.valueAsString,
      domainNameCertificateArn: certParameter.valueAsString,
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



