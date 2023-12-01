import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface EcrStackProps extends cdk.StackProps {
  name?: string,
}

export class EcrStack extends cdk.Stack {
  readonly repository: ecr.Repository;
  readonly repositoryExportName: string;
  readonly repositoryExportArn: string;
  
  constructor(scope: Construct, id: string, props?: EcrStackProps) {
    super(scope, id, props);
    let repositoryName = props?.name ?? undefined;
    if( repositoryName ) repositoryName = repositoryName.toLowerCase();
    this.repository = new ecr.Repository(this, 'Repo', {
      repositoryName,
      imageTagMutability: ecr.TagMutability.MUTABLE, // keep mutable, commit-hash is unique
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      encryption: ecr.RepositoryEncryption.AES_256,
    });
  
    this.repositoryExportName = id + 'RepositoryName';

    new cdk.CfnOutput(this, 'RepositoryName', {
      value: this.repository.repositoryName,
      exportName: this.repositoryExportName,
      description: 'The Name of the Repository',
    });

    this.repositoryExportArn = id + 'RepositoryARN'; 
    new cdk.CfnOutput(this, 'RepositoryARN', {
      value: this.repository.repositoryArn,
      exportName: this.repositoryExportArn,
      description: 'The ARN of the Repository',
    });
  }
}
