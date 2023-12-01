import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3_deployment from 'aws-cdk-lib/aws-s3-deployment'
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';


import { Construct } from 'constructs';

export interface CloudCityDistributionProps {
  api: apigateway.IRestApi;
  websocketApi: apigatewayv2.IWebSocketApi;
  userPool: cognito.UserPool;
  domainName?: string;
  domainNameCertificateArn?: string;
}

export class CloudCityDistribution extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly staticAssetsBucket: s3.Bucket;
  public readonly o2cBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CloudCityDistributionProps ) {
    super( scope, id );

    const stack = cdk.Stack.of(this);

    this.staticAssetsBucket = new s3.Bucket(this, 'StaticAssets', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.o2cBucket = new s3.Bucket(this, 'O2C', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new s3_deployment.BucketDeployment(this, 'WebsiteDeployment', {
      sources: [s3_deployment.Source.asset(path.join(__dirname, '..', 'www'))],
      destinationBucket: this.staticAssetsBucket
    });

    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      signing: cloudfront.Signing.SIGV4_ALWAYS
    });

    this.distribution = new cloudfront.Distribution( this, id, {
      domainNames: props.domainName && props.domainName.length ? [props.domainName] : undefined,
      certificate: props.domainName && props.domainNameCertificateArn ? 
                    acm.Certificate.fromCertificateArn(scope, 'Cert', props.domainNameCertificateArn) : 
                    undefined,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(this.staticAssetsBucket,{
          originAccessControl: oac
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          origin: new cloudfront_origins.HttpOrigin( `${props.api.restApiId}.execute-api.${stack.region}.${stack.urlSuffix}`),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, 'PublicApiCachePolicy', {

            minTtl: cdk.Duration.seconds(10), //FIXME: pick a usable value for prod
            defaultTtl: cdk.Duration.seconds(20), //FIXME: pick a usable value for prod
            maxTtl: cdk.Duration.seconds(30), //FIXME: pick a usable value for prod

            comment: 'Pass the query string and set TTL',
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
          }),
        },
        '/dev': {
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: false,
          origin: new cloudfront_origins.HttpOrigin( `${props.websocketApi.apiId}.execute-api.${stack.region}.${stack.urlSuffix}`),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
        },
        '/ws2.0/*': {
          origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(this.o2cBucket,{
            originAccessControl: oac
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,

        }
      },
      defaultRootObject: 'index.html',
    });

    const bucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [this.staticAssetsBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
    });
    bucketPolicy.addCondition( "StringEquals", {
      "aws:SourceArn": `arn:aws:cloudfront::${stack.account}:distribution/${this.distribution.distributionId}`,
    });
    this.staticAssetsBucket.addToResourcePolicy( bucketPolicy );
  }
};
