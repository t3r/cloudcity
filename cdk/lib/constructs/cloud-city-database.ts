import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class CloudCityDatabase extends Construct {

  public readonly securityGroup: ec2.SecurityGroup;
  public readonly dbCluster: rds.IDatabaseCluster;

  constructor(scope: Construct, id: string, props: any ) {

    super(scope, id );

    this.securityGroup = new ec2.SecurityGroup(this, id + '-SecurityGroup', {
      vpc: props.vpc,
    });

    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(5432),
      'allow inbound traffic from anywhere to the db on port 5432'
    );
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'allow inbound traffic from anywhere to the db on port 5432'
    );

    this.dbCluster = new rds.DatabaseCluster(this, id + '-Cluster', {
      vpc: props.vpc,
      vpcSubnets: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      securityGroups: [ this.securityGroup ],

      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_2,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2.0,
      clusterIdentifier: 'cloudcity',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      defaultDatabaseName: 'osm',
      port: 5432,
    });
  }

}

