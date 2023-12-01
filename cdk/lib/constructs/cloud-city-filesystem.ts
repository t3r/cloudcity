import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';

import { Construct } from 'constructs';

export class CloudCityFileSystem extends Construct {
  public readonly fileSystem: efs.FileSystem;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly accessPoint: efs.AccessPoint;
  public readonly accessPointPath: string;

  constructor(scope: Construct, id: string, props: any) {
    super(scope, id);

    this.accessPointPath = '/cloud-city';

    this.securityGroup = new ec2.SecurityGroup(this, id + '-SecurityGroup', {
      vpc: props.vpc,
      description: 'Allow inbound NFS Traffic',
    });
    this.securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(2049), 'allow nfs inbound');

    this.fileSystem = new efs.FileSystem(this, id + '-FileSystem', {
      vpc: props.vpc,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_1_DAY,
      transitionToArchivePolicy: efs.LifecyclePolicy.AFTER_7_DAYS,
      enableAutomaticBackups: false,
      oneZone: false,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.ELASTIC,
      outOfInfrequentAccessPolicy: efs.OutOfInfrequentAccessPolicy.AFTER_1_ACCESS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      securityGroup: this.securityGroup,
    });

    this.accessPoint = new efs.AccessPoint(this, id + '-AccessPoint', {
      fileSystem: this.fileSystem,
      createAcl: {
        ownerGid: '1000',
        ownerUid: '1000',
        permissions: '0755',
      },
      path: this.accessPointPath,
      posixUser: {
        gid: '1000',
        uid: '1000',
        // secondaryGids: ['secondaryGids'], // optional
      },
    });

    // this.efsSourceLocation = new DataSyncSourceLocation( this, 'SourceLocation', { vpc: props.vpc, cloudCityFileSystem: this })
  }
}



