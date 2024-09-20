import * as client_sfn from "@aws-sdk/client-sfn";
import { DataSyncClient, DescribeTaskExecutionCommand } from "@aws-sdk/client-datasync";

/*
{
    "version": "0",
    "id": "f7c1ece4-518a-761b-edef-aef6c305b69a",
    "detail-type": "DataSync Task Execution State Change",
    "source": "aws.datasync",
    "account": "533267260386",
    "time": "2024-09-19T09:36:33Z",
    "region": "eu-central-1",
    "resources": [
        "arn:aws:datasync:eu-central-1:533267260386:task/task-0806c70094b09457b/execution/exec-0fcddf3728817690d"
    ],
    "detail": {
        "State": "SUCCESS"
    }
}
*/

const sfnClient = new client_sfn.SFNClient();
const dataSyncClient = new DataSyncClient();

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    // Extract the DataSync task execution ARN from the event
    const taskExecutionArn = event.resources[0];
    if(  !taskExecutionArn ) {
      console.error("ERROR: No task ARN in event.");
      return {
        statusCode: 400,
        body: JSON.stringify('ARN not found in event.')
      }
    };
    try {
      console.log("ARN:", taskExecutionArn);
      // Get the DataSync task execution details
      const describeCommand = new DescribeTaskExecutionCommand({ TaskExecutionArn: taskExecutionArn });
      const taskExecution = await dataSyncClient.send(describeCommand);
      console.log("result:", JSON.stringify(taskExecution));

        return {
          statusCode: 200,
          body: JSON.stringify('Step Functions task completed successfully')
      };

    }
    catch (error) {
      console.error("Error describing task execution:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.$metadata) {
          console.error("Error metadata:", error.$metadata);
      }
      throw error;
    }

    // // Extract the DataSync task execution ARN from the event
    // const taskExecutionArn = event.detail.TaskExecutionArn;

    // try {
    //     // Get the DataSync task execution details
    //     const describeCommand = new DescribeTaskExecutionCommand({ TaskExecutionArn: taskExecutionArn });
    //     const taskExecution = await dataSyncClient.send(describeCommand);

    //     // Extract the task token from the task execution input
    //     const taskToken = taskExecution.TaskExecutionInput.StepFunctionsTaskToken;

    //     if (!taskToken) {
    //         throw new Error('No task token found in the DataSync task execution');
    //     }

    //     // Prepare the parameters for the SendTaskSuccess call
    //     const params = {
    //         taskToken: taskToken,
    //         output: JSON.stringify({
    //             status: 'SUCCESS',
    //             message: 'DataSync task completed successfully',
    //             taskExecutionArn: taskExecutionArn
    //         })
    //     };

    //     // Send the task success signal to Step Functions
    //     const command = new client_sfn.SendTaskSuccessCommand(params);
    //     const response = await sfnClient.send(command);

    //     console.log('Successfully sent task success:', response);
    //     return {
    //         statusCode: 200,
    //         body: JSON.stringify('Step Functions task completed successfully')
    //     };
    // } catch (error) {
    //     console.error('Error:', error);
    //     throw error;
    // }
    /*
    {
  "Start DataSync Task": {
    "Type": "Task",
    "Resource": "arn:aws:states:::datasync:startTaskExecution.waitForTaskToken",
    "Parameters": {
      "TaskArn": "arn:aws:datasync:region:account-id:task/task-id",
      "Includes": [
        {
          "FilterType": "SIMPLE_PATTERN",
          "Value": "**"
        }
      ],
      "TaskExecutionInput": {
        "StepFunctionsTaskToken.$": "$$.Task.Token"
      }
    },
    "Next": "Next State After DataSync"
  }
}

    {
  "Wait for DataSync": {
    "Type": "Task",
    "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
    "Parameters": {
      "FunctionName": "YourDataSyncTriggerLambda",
      "Payload": {
        "taskToken.$": "$$.Task.Token"
      }
    },
    "Next": "Next State After DataSync"
  }
}
    */
};