import {Injectable} from '@nestjs/common';
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import {PulumiUtil} from '../pulumi.util';
import {CommonUtil} from '../../../../../_util/_common.util';
import {AwsValidator} from 'src/_validator/_aws.validator';

@Injectable()
export class ComputingFargate_Stack {
  static getStackParams() {
    return {
      vpcId: 'vpc-086e9a2695d4f7001',
      ecrName: 'worldzhy',
      ecsContainerPort: 3000,
      ecsLoadbalancerPort: 80,
      ecsClusterName: 'example-cluster',
      maxTaskCount: 100,
      minTaskCount: 1,
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
    return ['loadBalancerDnsName'];
  }

  static getStackProgram =
    (
      params: {
        vpcId?: string;
        ecrName: string; // required
        ecsContainerPort: number; // required
        ecsLoadbalancerPort?: number; // default 80
        ecsClusterName?: string;
        minTaskCount?: number;
        maxTaskCount?: number;
      },
      awsRegion: string
    ) =>
    async () => {
      let vpcId = params.vpcId;
      const ecrName = params.ecrName;
      const ecsContainerPort = params.ecsContainerPort;
      let loadbalancerPort = params.ecsLoadbalancerPort;
      let clusterName = params.ecsClusterName;
      let minTaskCount = params.minTaskCount;
      let maxTaskCount = params.maxTaskCount;

      // Guard statement.
      if (!AwsValidator.verifyRegion(awsRegion)) {
        return undefined;
      }
      if (vpcId === undefined || vpcId === null || vpcId.trim() === '') {
        vpcId = (await aws.ec2.getVpc({default: true})).id;
      }
      if (
        clusterName === undefined ||
        clusterName === null ||
        clusterName.trim() === ''
      ) {
        clusterName = 'my-cluster';
      }
      if (loadbalancerPort === undefined) {
        loadbalancerPort = 80;
      }
      if (minTaskCount === undefined || minTaskCount === null) {
        minTaskCount = 1;
      }
      if (maxTaskCount === undefined || maxTaskCount === null) {
        maxTaskCount = 100;
      }

      // [step 1] Create an ECS cluster as the logical grouping of tasks or services.
      let uniqueResourceName = 'ecs-cluster';
      const cluster = new aws.ecs.Cluster(
        uniqueResourceName,
        {name: clusterName},
        PulumiUtil.getResourceOptions(awsRegion)
      );

      // [step 2] Prepare a task definition for container service.
      // [step 2-1] Get a docker image repository.
      const repository = await aws.ecr.getRepository({
        name: ecrName,
      });

      // [step 2-2] Create an application loadbalancer.
      const securityGroup = PulumiUtil.generateSecurityGroup(
        [ecsContainerPort],
        vpcId
      );
      uniqueResourceName = 'loadbalancer';
      const lbName = ecrName + '-lb-' + CommonUtil.randomCode(4);
      const lb = new awsx.lb.ApplicationLoadBalancer(
        uniqueResourceName,
        {
          name: lbName,
          listener: {port: loadbalancerPort},
          defaultTargetGroup: {
            port: ecsContainerPort,
          },
          securityGroups: [securityGroup.id],
        },
        PulumiUtil.getResourceOptions(awsRegion)
      );

      // [step 2-3] Create a task definition. https://docs.aws.amazon.com/AmazonECS/latest/userguide/fargate-task-defs.html
      uniqueResourceName = 'task-definition';
      const taskDefinition = new awsx.ecs.FargateTaskDefinition(
        uniqueResourceName,
        {
          container: {
            image: repository.repositoryUrl + ':latest',
            essential: true,
            portMappings: [
              {
                containerPort: ecsContainerPort, // Only 'awsvpc' network mode is available for fargate. And 'hostPort' equals to 'containerPort' in the 'awsvpc' network.
                protocol: 'tcp',
                targetGroup: lb.defaultTargetGroup,
              },
            ],
          },
          cpu: '1024',
          memory: '2048',
        },
        {
          transformations: [
            // Update all RolePolicyAttachment resources to use aws-cn ARNs.
            args => {
              if (
                args.type ===
                'aws:iam/rolePolicyAttachment:RolePolicyAttachment'
              ) {
                const arn: string | undefined = args.props['policyArn'];
                if (arn && arn.startsWith('arn:aws:iam')) {
                  args.props['policyArn'] = arn.replace(
                    'arn:aws:iam',
                    'arn:aws-cn:iam'
                  );
                }
                return {
                  props: args.props,
                  opts: args.opts,
                };
              }
              return undefined;
            },
          ],
        }
      );

      // [step 3] Create a constainer service.
      uniqueResourceName = 'fargate-service';
      const fargateServiceName =
        ecrName + '-service-' + CommonUtil.randomCode(4);
      const containerService = new awsx.ecs.FargateService(
        uniqueResourceName,
        {
          name: fargateServiceName,
          cluster: cluster.arn,
          desiredCount: minTaskCount + 1,
          deploymentMinimumHealthyPercent: 100,
          deploymentMaximumPercent: 500,
          taskDefinition: taskDefinition.taskDefinition.arn,
        },
        {
          transformations: [
            // Update all RolePolicyAttachment resources to use aws-cn ARNs.
            args => {
              if (
                args.type ===
                'aws:iam/rolePolicyAttachment:RolePolicyAttachment'
              ) {
                const arn: string | undefined = args.props['policyArn'];
                if (arn && arn.startsWith('arn:aws:iam')) {
                  args.props['policyArn'] = arn.replace(
                    'arn:aws:iam',
                    'arn:aws-cn:iam'
                  );
                }
                return {
                  props: args.props,
                  opts: args.opts,
                };
              }
              return undefined;
            },
          ],
        }
      );

      // [step 4] Add auto-scaling target for container service.
      // [step 4-1] Create an auto-scaling target.
      uniqueResourceName = 'scaling-target';
      const ecsTarget = new aws.appautoscaling.Target(
        uniqueResourceName,
        {
          maxCapacity: maxTaskCount,
          minCapacity: minTaskCount,
          resourceId: pulumi.interpolate`service/${cluster.name}/${containerService.service.name}`,
          // roleArn:
          scalableDimension: 'ecs:service:DesiredCount',
          serviceNamespace: 'ecs',
        },
        PulumiUtil.getResourceOptions(awsRegion)
      );

      // [step 4-2] Bind policies to the auto-scaling target.
      uniqueResourceName = 'scaling-up-policy';
      new aws.appautoscaling.Policy(
        uniqueResourceName,
        {
          policyType: 'StepScaling',
          resourceId: ecsTarget.resourceId,
          scalableDimension: ecsTarget.scalableDimension,
          serviceNamespace: ecsTarget.serviceNamespace,
          stepScalingPolicyConfiguration: {
            adjustmentType: 'PercentChangeInCapacity',
            cooldown: 60,
            metricAggregationType: 'Maximum',
            minAdjustmentMagnitude: 1, // The least task count for increasing or decreasing.
            stepAdjustments: [
              {
                metricIntervalUpperBound: '60',
                scalingAdjustment: 100,
              },
            ],
          },
        },
        PulumiUtil.getResourceOptions(awsRegion)
      );

      uniqueResourceName = 'scaling-down-policy';
      new aws.appautoscaling.Policy(
        uniqueResourceName,
        {
          policyType: 'StepScaling',
          resourceId: ecsTarget.resourceId,
          scalableDimension: ecsTarget.scalableDimension,
          serviceNamespace: ecsTarget.serviceNamespace,
          stepScalingPolicyConfiguration: {
            adjustmentType: 'PercentChangeInCapacity',
            cooldown: 60,
            metricAggregationType: 'Maximum',
            minAdjustmentMagnitude: 1, // The least task count for increasing or decreasing.
            stepAdjustments: [
              {
                metricIntervalLowerBound: '20',
                scalingAdjustment: -50,
              },
            ],
          },
        },
        PulumiUtil.getResourceOptions(awsRegion)
      );

      return {
        loadBalancerDnsName: lb.loadBalancer.dnsName,
      };
    };
}
