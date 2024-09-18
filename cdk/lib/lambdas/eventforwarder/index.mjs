const { SFNClient, SendTaskSuccessCommand } = require("@aws-sdk/client-sfn");

const sfnClient = new SFNClient();

export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Extract the DataSync task execution ARN from the event
    const taskExecutionArn = event.detail.TaskExecutionArn;

    try {
        // Get the DataSync task execution details
        const describeCommand = new DescribeTaskExecutionCommand({ TaskExecutionArn: taskExecutionArn });
        const taskExecution = await dataSyncClient.send(describeCommand);

        // Extract the task token from the task execution input
        const taskToken = taskExecution.TaskExecutionInput.StepFunctionsTaskToken;

        if (!taskToken) {
            throw new Error('No task token found in the DataSync task execution');
        }

        // Prepare the parameters for the SendTaskSuccess call
        const params = {
            taskToken: taskToken,
            output: JSON.stringify({
                status: 'SUCCESS',
                message: 'DataSync task completed successfully',
                taskExecutionArn: taskExecutionArn
            })
        };

        // Send the task success signal to Step Functions
        const command = new SendTaskSuccessCommand(params);
        const response = await sfnClient.send(command);

        console.log('Successfully sent task success:', response);
        return {
            statusCode: 200,
            body: JSON.stringify('Step Functions task completed successfully')
        };
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
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
