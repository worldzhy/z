import {Injectable} from '@nestjs/common';
import * as aws from '@pulumi/aws';
import {PulumiUtil} from '../pulumi.util';

@Injectable()
export class AwsVpc_Stack {
  static getStackParams() {
    return {
      vpcName: 'pulumi-test-vpc',
      vpcCidrBlock: '10.21.0.0/16',
    };
  }

  static checkStackParams(params: object) {
    if (params) {
      return true;
    } else {
      return false;
    }
  }

  static getStackOutputKeys() {
    return ['vpcId', 'defaultSecurityGroup'];
  }

  static getStackProgram =
    (params: {vpcName?: string; vpcCidrBlock?: string}, awsConfig: any) =>
    async () => {
      let vpcName = params.vpcName;
      let vpcCidrBlock = params.vpcCidrBlock;

      // [step 1] Guard statement.
      if (vpcName === undefined || vpcName === null || vpcName.trim() === '') {
        vpcName = 'development-vpc';
      }
      if (
        vpcCidrBlock === undefined ||
        vpcCidrBlock === null ||
        vpcCidrBlock.trim() === ''
      ) {
        vpcCidrBlock = '10.10.0.0/16';
      }

      // Allocate development, production and management VPCs.
      const uniqueResourceName = 'vpc';
      const vpc = new aws.ec2.Vpc(
        uniqueResourceName,
        {
          cidrBlock: vpcCidrBlock,
        },
        PulumiUtil.getResourceOptions(awsConfig.region)
      );

      return {
        vpcId: vpc.id,
        defaultSecurityGroup: vpc.defaultSecurityGroupId,
      };
    };
}
