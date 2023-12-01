#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CloudCityBuildStack } from '../lib/cloud_city-build-stack';

const app = new cdk.App();

const env = {
  account: process.env.AWS_ACCOUNT_ID,
  region: process.env.AWS_REGION,
};

const cloudCityBuildStack = new CloudCityBuildStack(app, 'CloudCityBuilder', {
  env,
  description: 'Process OSM2City for the entire planet and build Cloud City.',
});

cdk.Tags.of(app).add('app', 'cloud-city');

app.synth();
