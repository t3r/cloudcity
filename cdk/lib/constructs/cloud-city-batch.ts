import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as vpc from 'aws-cdk-lib/aws-ec2'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ecr from 'aws-cdk-lib/aws-ecr';

import { Construct } from 'constructs';

export interface CloudCityBatchProps extends cdk.StackProps {
  fileSystem: efs.IFileSystem,
  accessPoint: efs.IAccessPoint
  vpc: vpc.Vpc,
  table: dynamodb.TableV2,
}

export class CloudCityBatch extends Construct {
  public readonly fargateQueue: batch.JobQueue;
  public readonly jobDefinitions: Record<string,batch.EcsJobDefinition>
  public readonly taskRole: iam.Role;
  public readonly topic: sns.Topic;
  public readonly builderRepository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: CloudCityBatchProps ) {
    super(scope, id);

    this.jobDefinitions = {}

    this.topic = new sns.Topic(this, 'ErrorTopic', {
      displayName: 'CloudCity tile builder',
      topicName: 'cloudcity-tile-builder',
      fifo: false,
    });

    this.builderRepository = new ecr.Repository(this,'BuilderRepository', {
      repositoryName: 'cloudcity',
      imageTagMutability: ecr.TagMutability.MUTABLE, // keep mutable, commit-hash is unique
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      encryption: ecr.RepositoryEncryption.AES_256,
    })

    const taskRole =  new iam.Role(this, id + '-TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Task Role for cloud-city',
    });

    taskRole.attachInlinePolicy(new iam.Policy(this, 'AllowEfs', {
      statements: [
        new iam.PolicyStatement({
          actions: [ "elasticfilesystem:ClientMount", "elasticfilesystem:ClientWrite" ],
          effect: iam.Effect.ALLOW,
          resources: [ props.fileSystem.fileSystemArn ]
        }),

        new iam.PolicyStatement({
          actions: [ "kms:Decrypt", "secretsmanager:GetSecretValue" ],
          effect: iam.Effect.ALLOW,
          resources: [ "arn:aws:secretsmanager:eu-central-1:533267260386:secret:gitlab-docker-cIw1N7",
                       "arn:aws:kms:eu-central-1:533267260386:aws/secretsmanager", ]
        })
      ]
    }));

    const fargateQSG = new ec2.SecurityGroup(this,'FargateQSQ', {
      vpc: props.vpc,
      description: 'Security group for Fargate Queue, enble alloutboud traffic fir ip4 and ip6',
      allowAllOutbound: true,
      allowAllIpv6Outbound: true
    })

    this.fargateQueue = new batch.JobQueue( this, 'FargateQ', {
      computeEnvironments: [{
        computeEnvironment: new batch.FargateComputeEnvironment(this, 'FargateEnv', {
          vpc: props.vpc,
          vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
          securityGroups:  [fargateQSG], 
          enabled: true,
          maxvCpus: 256,
          replaceComputeEnvironment: true,
          spot: false,
        }),
        order: 0,
      }],
    });

    const efsVolume = new batch.EfsVolume({
      containerPath: '/workspace',
      name: 'EFS',
      fileSystem: props.fileSystem,
      readonly: false, // Set to true if you want the volume to be read-only
      useJobRole: true,
      accessPointId: props.accessPoint.accessPointId,
      enableTransitEncryption: true,
      rootDirectory: '/',
    });

    const imageTag = this.node.tryGetContext('image-tag') ?? 'latest';
    const image: cdk.aws_ecs.ContainerImage
      = ecs.ContainerImage.fromEcrRepository( this.builderRepository, imageTag );

    const ContainerDefs = {
      osm2cityBuilder: {
        // fargateCpuArchitecture: ecs.CpuArchitecture.ARM64,
        fargateCpuArchitecture: ecs.CpuArchitecture.X86_64,
        fargateOperatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpu: 1, // vCPU
        memory: cdk.Size.gibibytes(6), // works for Berlin
        image,
        jobRole: taskRole,
        assignPublicIp: true, // required to pull image from public registry
        volumes: [ efsVolume ],
        secrets: {
        },
        environment: {
          FG_ROOT: '/workspace/fg_root',
          FG_SCENERY: '/workspace/scenery',
          OSM2CITY_PATH_TO_OUTPUT: '/workspace/o2c-scenery',
          OSM2CITY_PATH_TO_PACKED: '/workspace/o2c-packed',
          O2C_PROCESSES: '1',
          OVERPASS_URI: 'https://overpass.kumi.systems/api/interpreter',
        },
        command: [
          'scripts/build.sh',
          '--tile', 'Ref::tile'
        ],
      },

      osm2cityPacker: {
        // fargateCpuArchitecture: ecs.CpuArchitecture.ARM64,
        fargateCpuArchitecture: ecs.CpuArchitecture.X86_64,
        fargateOperatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpu:  4, // vCPU
        memory: cdk.Size.gibibytes(8),
        image,
        jobRole: taskRole,
        assignPublicIp: true, // required to pull image from public registry
        volumes: [ efsVolume ],
        secrets: {
        },
        environment: {
          FG_ROOT: '/workspace/fg_root',
          FG_SCENERY: '/workspace/scenery',
          OSM2CITY_PATH_TO_OUTPUT: '/workspace/o2c-scenery',
          OSM2CITY_PATH_TO_PACKED: '/workspace/o2c-packed',
          O2C_PROCESSES: '1',
          OVERPASS_URI: 'https://overpass.kumi.systems/api/interpreter',
        },
        command: [
          'scripts/pack.sh'
        ],
      },

    }

    const JobDefs = {

/*
      TerraSync: {
        propagateTags: true,
        container: new batch.EcsFargateContainerDefinition(this, 'terrasync', {
          cpu: 0.25,
          memory: cdk.Size.gibibytes(0.5),
          image: ecs.ContainerImage.fromRegistry('torstend/terrasync'),
          jobRole: taskRole,
          assignPublicIp: true,
          volumes: [ efsVolume ],
          command: [
            "-t","/workspace/scenery",
            "-u","Ref::url",
            "--only-subdir","Models" ],
        }),
        parameters :{
          url: "https://ukmirror.flightgear.org/fgscenery",
        }
      },
*/

      // Ec2Builder: {
      //   propagateTags: true,
      //   container: new batch.EcsEc2ContainerDefinition(this, 'build-ec2', ContainerDefs.osm2cityBuilder ),
      //   timeout: cdk.Duration.hours(2),
      //   parameters : {
      //     tile: '0'
      //   }
      // },

      FgBuilder: {
        propagateTags: true,
        container: new batch.EcsFargateContainerDefinition(this, 'build-fg', ContainerDefs.osm2cityBuilder ),
        timeout: cdk.Duration.hours(8),
        parameters : {
          tile: '0'
        },
        retryAttempts: 3,
        retryStrategies: [
          batch.RetryStrategy.of( batch.Action.RETRY, batch.Reason.custom({
            onExitCode: '143',  // Retry on sigterm
          })),
        ],
      },

      // Ec2Packer: {
      //   propagateTags: true,
      //   container: new batch.EcsEc2ContainerDefinition(this, 'pack-ec2', ContainerDefs.osm2cityPacker ),
      //   timeout: cdk.Duration.hours(2),
      // },

      FgPacker: {
        propagateTags: true,
        container: new batch.EcsFargateContainerDefinition(this, 'pack-fg', ContainerDefs.osm2cityPacker ),
        timeout: cdk.Duration.hours(2),
      },

    };

    for( const [ name, jobDef ] of Object.entries(JobDefs) ) {
       this.jobDefinitions[name] = new batch.EcsJobDefinition(this, name, jobDef );
    }
  }
}

