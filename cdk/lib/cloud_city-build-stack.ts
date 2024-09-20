import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { CloudCityVpc } from './constructs/cloud-city-vpc';
import { CloudCityFileSystem } from './constructs/cloud-city-filesystem';
import { CloudCityBatch } from './constructs/cloud-city-batch';
import { CloudCitySteps } from './constructs/cloud-city-steps';
import { CloudCityTilesTable } from './constructs/cloud-city-tilestable';
import { CloudCityUi } from './constructs/cloud-city-ui';
import {
  DataSyncSourceLocation,
  DataSyncDestinationLocation,
  DataSyncTask,
  DataSyncEventRule } from './constructs/cloud-city-datasync';

export interface CloudCityBuildStackProps extends cdk.StackProps {
}

export class CloudCityBuildStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudCityBuildStackProps ) {
    super(scope, id, props);

    const { vpc } = new CloudCityVpc(this, 'VPC');
    const { accessPoint, fileSystem, securityGroup } = new CloudCityFileSystem( this, id + '-EFS', { vpc } );

    const tilesTable = new CloudCityTilesTable( this,  'TilesTable' );

    const { o2cBucket } = new CloudCityUi( this, 'UI', {
      tilesTable: tilesTable.table,
    })

    const { efsLocation } = new DataSyncSourceLocation(this,'EFSSourceLocation', {
      vpc,
      accessPoint,
      accessPointPath:  '/',
      fileSystem,
      securityGroup,
    })

    const { s3Location } = new DataSyncDestinationLocation(this,'S3DestinationLocation', {
      bucket: o2cBucket,
    });

    const { dataSyncTask } = new DataSyncTask( this, 'SyncO2C', {
      source: efsLocation,
      dest: s3Location,
    });

    const dataSyncEventRule = new DataSyncEventRule(this, 'DataSyncEventRule', {
      dataSyncTaskARN: dataSyncTask.ref,
    });


    const { fargateQueue, jobDefinitions, topic } = new CloudCityBatch( this, id + 'Batch', {
      vpc,
      fileSystem,
      accessPoint,
      table: tilesTable.table,
    });

    const { stateMachine } = new CloudCitySteps( this, id + 'Sfn', {
      jobQueueARN: fargateQueue.jobQueueArn,
      buildJobDefinitionARN:  jobDefinitions['FgBuilder'].jobDefinitionArn,
      packJobDefinitionARN:  jobDefinitions['FgPacker'].jobDefinitionArn,
      errorSNSTopicARN: topic.topicArn,
      dataSyncTaskARN: dataSyncTask.ref,
      table: tilesTable.table,
    });
  }

}
