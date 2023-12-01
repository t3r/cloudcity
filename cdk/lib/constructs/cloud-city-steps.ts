import * as cdk from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as fs from 'fs';
import * as path  from 'path';



import { Construct } from 'constructs';

export interface CloudCityStepsProps extends cdk.StackProps {
  table: dynamodb.TableV2,
  jobQueueARN: string,
  buildJobDefinitionARN: string,
  packJobDefinitionARN: string,
  errorSNSTopicARN: string,
  dataSyncTaskARN: string,
}

export class CloudCitySteps extends Construct {
  public readonly stateMachine: sfn.IStateMachine;

  constructor(scope: Construct, id: string, props: CloudCityStepsProps ) {
    super(scope, id);

    const role =  new iam.Role(this, id + 'Role', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      description: 'StateMachine Role for cloud-city',
    });

    role.attachInlinePolicy(new iam.Policy(this, id + 'StepFunction', {
/*
  https://ataiva.com/how-to-fix-is-not-authorized-to-create-managed-rule-in-aws-step-functions/
  add CloudWatchEventsFullAccess
*/
      statements: [
        new iam.PolicyStatement({
          actions: [  
            "batch:SubmitJob", 
            "batch:DescribeJobs", 
            "batch:TerminateJob", 
            "states:StartExecution" 
          ],
          effect: iam.Effect.ALLOW,
          resources: [ "*" ] 
        }),
        new iam.PolicyStatement({
          actions: [ 
            "xray:PutTraceSegments", 
            "xray:PutTelemetryRecords", 
            "xray:GetSamplingRules", 
            "xray:GetSamplingTargets" ],
          effect: iam.Effect.ALLOW,
          resources: [ "*" ] 
        }),
        new iam.PolicyStatement({
          actions: [
            "dynamodb:Query",
          ],
          effect: iam.Effect.ALLOW,
          resources: [props.table.tableArn + '/index/gsi_status']
        }),
        new iam.PolicyStatement({
          actions: [
            "dynamodb:UpdateItem",
          ],
          effect: iam.Effect.ALLOW,
          resources: [props.table.tableArn]
        }),
        new iam.PolicyStatement({
          actions: [
            "events:PutTargets",
            "events:PutRule",
            "events:DescribeRule"
          ],
          effect: iam.Effect.ALLOW,
          resources: ["*"]
        }),
        new iam.PolicyStatement({
          actions: [
            "SNS:Publish",
          ],
          effect: iam.Effect.ALLOW,
          resources: [props.errorSNSTopicARN]
        }),
        new iam.PolicyStatement({
          actions: [
            "datasync:StartTaskExecution",
          ],
          effect: iam.Effect.ALLOW,
          resources: [props.dataSyncTaskARN]
        }),
        new iam.PolicyStatement({ // Needed for StartTaskExecution
          actions: [
            "ec2:DescribeNetworkInterfaces",
          ],
          effect: iam.Effect.ALLOW,
          resources: ["*"]
        })
      ]
    }));

    // These following const variables are used in the statemachine definition. 
    // Do not remove!
    const TableName = props.table.tableName; TableName;
    const JobQueueARN =props.jobQueueARN; JobQueueARN;
    const BuildJobDefinitionARN = props.buildJobDefinitionARN;BuildJobDefinitionARN;
    const PackJobDefinitionARN = props.packJobDefinitionARN;PackJobDefinitionARN;
    const SNSErrorTopicARN = props.errorSNSTopicARN; SNSErrorTopicARN;
    const DataSyncTaskARN = props.dataSyncTaskARN;  DataSyncTaskARN;
    // End of statemachine variable definitions
    
    const stateMachineDefinition = eval("`"+fs.readFileSync( path.join(__dirname, 'statemachine.json'), 'utf8')+"`");
    this.stateMachine = new sfn.StateMachine( this, id + 'TileBuilder', {
      role,
      definitionBody: sfn.DefinitionBody.fromString(stateMachineDefinition)
    });
  }
}
