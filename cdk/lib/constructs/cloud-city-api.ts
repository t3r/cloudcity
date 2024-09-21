import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';

import * as path from 'path';

import { Construct } from 'constructs';

export interface CloudCityApiProps {
  tilesTable: dynamodb.ITableV2,
}

export class CloudCityApi extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.IUserPoolClient;
  public readonly userPoolDomain: cognito.IUserPoolDomain;
  public readonly websocketTable: dynamodb.ITableV2;
  public readonly websocketApi: apigatewayv2.WebSocketApi;
  public readonly websocketIntegrationLambda: lambda.IFunction;
  public readonly webSocketStage: apigatewayv2.WebSocketStage;
  public readonly streamTriggerLambda: lambda.IFunction;
  public readonly apiEndpoint: string;


  constructor(scope: Construct, id: string, props: CloudCityApiProps ) {
    super(scope, id);

    const stack = cdk.Stack.of(this);

    this.userPool = new cognito.UserPool( this, id + '-Pool', {
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      signInAliases: { email: true },
      selfSignUpEnabled: true,
    });
    this.userPoolClient = this.userPool.addClient('Client', {
      authFlows: {
        userSrp: true,
      },
      oAuth: {
        flows: {
          implicitCodeGrant: true,
        },
        callbackUrls: [
          'http://localhost:8080/',
          'https://cloudcity.flightgear.org/',
        ],
      },
    });
    this.userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: 'cloudcity',
      },
    });

    const authUrl = `https://${this.userPoolDomain.domainName}.auth.${stack.region}.amazoncognito.com/oauth2/authorize?client_id=${this.userPoolClient.userPoolClientId}&response_type=token&scope=aws.cognito.signin.user.admin+email+openid+phone+profile&redirect_uri=https%3A%2F%2Fcloudcity.flightgear.org%2F`

    const userPoolAdminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      description: 'Admins of CloudCity, can do admin stuff.',
      groupName: 'admins',
      precedence: 0,
    });

    const userPoolSupportersGroup = new cognito.CfnUserPoolGroup(this, 'SupportersGroup', {
      userPoolId: this.userPool.userPoolId,
      description: 'Supporters of CloudCity, can see more than others.',
      groupName: 'supporters',
      precedence: 10,
    });

    // The websocket API
    this.websocketApi =  new apigatewayv2.WebSocketApi(this, 'WSApi', {
      description: 'CloudCity websocket API',
    });

    this.webSocketStage = new apigatewayv2.WebSocketStage(this, 'stage-dev', {
      webSocketApi: this.websocketApi,
      stageName: 'dev',
      autoDeploy: true,
    });
    this.apiEndpoint = `https://${this.websocketApi.apiId}.execute-api.${stack.region}.amazonaws.com/${this.webSocketStage.stageName}`;

    // DDB table to store websocket connection ids
    this.websocketTable = new dynamodb.TableV2(this, 'WSConnections', {
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: { name: 'ConnectionId', type: dynamodb.AttributeType.STRING }
    });
  
    // the websocket integration lambda
    this.websocketIntegrationLambda = new lambda.Function(this, 'WSIntegration', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas', 'wsconnect' )),
      description: 'CloudCity integration handler for websocket API',
      environment: {
        CONNECTIONS_TABLE: this.websocketTable.tableName,
        TILES_TABLE: props.tilesTable.tableName,
      },
    });
    // needs to write connection ids to the websock table
    this.websocketTable.grantWriteData(this.websocketIntegrationLambda);
    props.tilesTable.grantReadWriteData(this.websocketIntegrationLambda);

    // the trigger function for the tile table stream
    this.streamTriggerLambda = new lambda.Function(this, 'TileChangeTrigger', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas', 'trigger' )),
      description: 'Trigger function for the CloudCity dynamodb tile table stream',
      environment: {
        API_GATEWAY_ENDPOINT: this.apiEndpoint,
        CONNECTIONS_TABLE: this.websocketTable.tableName
      },
    });
    // needs to read the websocket connection ids
    this.websocketTable.grantReadData(this.streamTriggerLambda);

    // connect tilesTable and streamTriggerLambda
    props.tilesTable.grantStreamRead(this.streamTriggerLambda);
    this.streamTriggerLambda.addEventSource(
      new eventsources.DynamoEventSource(props.tilesTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 100,
        maxBatchingWindow: cdk.Duration.seconds(5),
        retryAttempts: 3,
      })
    );

    // allow manage connections of the websocket api (POST to @connection)
    this.websocketApi.grantManageConnections(this.streamTriggerLambda);

    this.websocketApi.addRoute('$connect', {
      integration: new WebSocketLambdaIntegration(id+'WSIntegrationConnect', this.websocketIntegrationLambda),
    });
    this.websocketApi.addRoute('$disconnect', {
      integration: new WebSocketLambdaIntegration('WSIntegrationDisconnect', this.websocketIntegrationLambda),
    });
    const defaultRoute = this.websocketApi.addRoute('$default', {
      integration: new WebSocketLambdaIntegration('WSIntegrationDefault', this.websocketIntegrationLambda),
      //returnResponse: true,
    });

    // Enable route-response for $default route
    const cfn_route_response = new apigatewayv2.CfnRouteResponse(this, "DefaultResponse", {
      apiId: this.websocketApi.apiId,
      routeId: defaultRoute.routeId,
      routeResponseKey: '$default'
    });
    
    // REST API
    const apiLambda =  new lambda.Function( this, 'ApiIntegrationLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [ 'dynamodb:Query' ],
          resources: [props.tilesTable.tableArn + '/*'],
        }),
      ],
      description: 'REST API Implementation for the CloudCity',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambdas', 'api' )),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(15),
      environment: {
        TABLE_NAME: props.tilesTable.tableName,
      },
    });

    props.tilesTable.grantReadWriteData( apiLambda );

    const apiIntegration = new apigateway.LambdaIntegration( apiLambda );
    
    this.api = new apigateway.RestApi( this, id + '-REST', {
      description: 'REST API for CloudCity',
      deployOptions: {
        stageName: 'api',
      },
      binaryMediaTypes: [],
      minCompressionSize: cdk.Size.mebibytes( 1 ),
      endpointConfiguration: {
        types: [ apigateway.EndpointType.REGIONAL ],
      },
    });

    const restApiAuthorizer = new apigateway.CognitoUserPoolsAuthorizer( this, 'Authorizer', {
      cognitoUserPools: [ this.userPool ],
    });

    this.api.root.addResource('tile').addResource('{id}')
      .addCorsPreflight({
          allowOrigins: apigateway.Cors.ALL_ORIGINS,
          allowMethods: [ 'GET', 'POST' ],
      })
      .resource.addMethod('GET', apiIntegration )
      .resource .addMethod('POST', apiIntegration, {
        authorizer: restApiAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO
      })

    this.api.root.addResource('1x1').addResource('{id}')
      .addCorsPreflight({
          allowOrigins: apigateway.Cors.ALL_ORIGINS,
          allowMethods: [ 'GET', 'POST' ],
      })
      .resource.addMethod('GET', apiIntegration )
      .resource.addMethod('POST', apiIntegration, {
        authorizer: restApiAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO
      })

    this.api.root.addResource('10x10').addResource('{id}')
      .addCorsPreflight({
          allowOrigins: apigateway.Cors.ALL_ORIGINS,
          allowMethods: [ 'GET', 'POST' ],
      })
      .resource.addMethod('GET', apiIntegration )
      .resource.addMethod('POST', apiIntegration, {
        authorizer: restApiAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO
      })

      const redirectIntegration = new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: '301',
            responseParameters: {
              'method.response.header.Location': `'${authUrl}'`,
            },
          },
        ],
        requestTemplates: {
          'application/json': JSON.stringify({
            statusCode: 301,
          }),
        },
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      });

      const redirectMethod = this.api.root.addResource('login').addMethod(
        'GET',
        redirectIntegration,
        {
          methodResponses: [
            {
              statusCode: '301',
              responseParameters: {
                'method.response.header.Location': true,
              },
            },
          ],
        }
      );
  }
};
