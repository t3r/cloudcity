import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface CloudCityVpcProps {
  cidr: string;
}
export class CloudCityVpc extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: CloudCityVpcProps ) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, id + '-VPC', {
      ipProtocol: ec2.IpProtocol.DUAL_STACK,
      natGateways: 0,
      maxAzs: 2,
      ipAddresses: ec2.IpAddresses.cidr(props.cidr),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
      {
        name: 'cloudcity-public',
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 24,
        ipv6AssignAddressOnCreation: true,
      },
      {
        name: "cloudcity-private",
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        cidrMask: 24,
        ipv6AssignAddressOnCreation: true,
      },
      ],
    });
  }
}

