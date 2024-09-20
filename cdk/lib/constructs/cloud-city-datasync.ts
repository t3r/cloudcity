import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as s3  from 'aws-cdk-lib/aws-s3';
import * as iam  from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

import * as datasync from 'aws-cdk-lib/aws-datasync';
import { Construct } from 'constructs';

export interface DataSyncSourceLocationProps {
  fileSystem: efs.FileSystem,
  accessPoint: efs.AccessPoint,
  accessPointPath: string,
  securityGroup: ec2.SecurityGroup
  vpc: ec2.IVpc
}

export interface DataSyncDestinationLocationProps {
  bucket: s3.IBucket
}

export class DataSyncDestinationLocation extends Construct {
  public readonly s3Location: datasync.CfnLocationS3;

  constructor(scope: Construct, id: string, props: DataSyncDestinationLocationProps) {
    super(scope, id);

    // Create an IAM role for DataSync to access the S3 bucket
    const dataSyncS3Role = new iam.Role(this, 'DataSyncS3Role', {
      assumedBy: new iam.ServicePrincipal('datasync.amazonaws.com'),
    });

    // Grant the necessary permissions to the role
    props.bucket.grantReadWrite(dataSyncS3Role);

    // Add s3:ListBucket permission
    // dataSyncS3Role.addToPolicy(new iam.PolicyStatement({
    //   actions: ['s3:ListBucket'],
    //   resources: [props.bucket.bucketArn],
    // }));

    // Get the existing bucket policy

     // Create new policy statements
     const listBucketStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket', 's3:GetBucketLocation', 's3:ListBucketMultipartUploads'],
      resources: [props.bucket.bucketArn],
      principals: [new iam.ArnPrincipal(dataSyncS3Role.roleArn)],
    });

    const objectOperationsStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:AbortMultipartUpload', 's3:ListMultipartUploadParts'],
      resources: [props.bucket.arnForObjects('*')],
      principals: [new iam.ArnPrincipal(dataSyncS3Role.roleArn)],
    });

    // Add new statements to the existing policy
    props.bucket.policy!.document.addStatements(listBucketStatement);
    props.bucket.policy!.document.addStatements(objectOperationsStatement);

    // Create the DataSync S3 location
    this.s3Location = new datasync.CfnLocationS3(this, 'S3DestinationLocation', {
      s3BucketArn: props.bucket.bucketArn,
      s3Config: {
        bucketAccessRoleArn: dataSyncS3Role.roleArn,
      },
      // s3StorageClass: s3.StorageClass.INFREQUENT_ACCESS,
      subdirectory: '/ws2.0',
    });
  }
}

export class DataSyncSourceLocation extends Construct {
  public readonly efsLocation: datasync.CfnLocationEFS;
  constructor(scope: Construct, id: string, props: DataSyncSourceLocationProps) {
    super(scope, id);
    const stack = cdk.Stack.of(this);

    // Create a security group for DataSync to access the EFS file system
    const dataSyncSecurityGroup = new ec2.SecurityGroup(this, 'DataSyncSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for DataSync to access EFS',
      allowAllOutbound: true,
    });

    // Allow inbound NFS traffic from the DataSync security group to the EFS security group
    props.securityGroup.addIngressRule(
      dataSyncSecurityGroup,
      ec2.Port.tcp(2049),
      'Allow NFS access from DataSync'
    );

    // Create the IAM role for DataSync
    const dataSyncRole = new iam.Role(this, 'DataSyncRole', {
      assumedBy: new iam.ServicePrincipal('datasync.amazonaws.com'),
    });

    // Add the required policy to the role
    dataSyncRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticfilesystem:ClientMount',
        //'elasticfilesystem:ClientWrite',
        'elasticfilesystem:ClientRootAccess'
      ],
      resources: [props.fileSystem.fileSystemArn],
    }));

    // Create the DataSync EFS location
    this.efsLocation = new datasync.CfnLocationEFS(this, 'EFSSourceLocation', {
      efsFilesystemArn: props.fileSystem.fileSystemArn,
      ec2Config: {
        securityGroupArns: [stack.formatArn({
          service: 'ec2',
          resource: 'security-group',
          resourceName: dataSyncSecurityGroup.securityGroupId,
        })],
        subnetArn: stack.formatArn({
          service: 'ec2',
          resource: 'subnet',
          resourceName: props.vpc.isolatedSubnets[0].subnetId
        })
      },
      accessPointArn: props.accessPoint.accessPointArn,
      inTransitEncryption: 'TLS1_2',
      subdirectory: props.accessPointPath,
      fileSystemAccessRoleArn:dataSyncRole.roleArn,
    });
  }
}

export interface DataSyncEventRuleProps {
  dataSyncTaskARN: string,
}

export class DataSyncEventRule extends Construct {
  constructor(scope: Construct, id: string, props: DataSyncEventRuleProps) {
    super(scope, id);

    // Create a Lambda function to handle the event
    const handler = new lambda.Function(this, 'DataSyncSuccessHandler', {
      description: 'Handler for the EventBridge to handle DataSync success events',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas', 'eventforwarder') ),
    });

    // Create the EventBridge rule
    const rule = new events.Rule(this, 'DataSyncSuccessRule', {
      eventPattern: {
        source: ['aws.datasync'],
        detailType: ['DataSync Task Execution State Change'],
        resources: [
          JSON.stringify({
            prefix: props.dataSyncTaskARN +  '/*',
          })
        ],
        detail: {
          State: ['SUCCESS'],
        }
      },
    });

    // Add the Lambda function as a target for the rule
    rule.addTarget(new targets.LambdaFunction(handler));
  }
}

export interface DataSyncTaskProps {
  source: datasync.CfnLocationEFS,
  dest: datasync.CfnLocationS3,
}

export class DataSyncTask extends Construct {
  public readonly dataSyncTask: datasync.CfnTask;

  constructor(scope: Construct, id: string, props: DataSyncTaskProps) {
    super(scope, id);

    // Create the DataSync task
    this.dataSyncTask = new datasync.CfnTask(this, 'DataSyncTask', {
      sourceLocationArn: props.source.attrLocationArn,
      destinationLocationArn: props.dest.attrLocationArn,
      cloudWatchLogGroupArn: 'arn:aws:logs:eu-central-1:533267260386:log-group:/aws/datasync:*',
      name: 'EFSDataSyncTask',
      includes: [ {
        filterType: 'SIMPLE_PATTERN',
        value: '/o2c-packed/*',
      } ],
      options: {
        verifyMode: 'NONE',
        overwriteMode: 'ALWAYS',
        preserveDeletedFiles: 'REMOVE',
        atime: 'BEST_EFFORT',
        mtime: 'PRESERVE',
        taskQueueing: 'ENABLED',
        logLevel: 'TRANSFER',
        transferMode: 'CHANGED',
      },
    });
  }
}
