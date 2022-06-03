import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import {PulumiUtil} from '../_util';

export const createContainerClusterInVpcStack =
  (params: {
    vpcId?: string;
    clusterName?: string;
    repositoryName: string;
    desiredTaskCount?: number;
    minTaskCount?: number;
    maxTaskCount?: number;
  }) =>
  async () => {
    let vpcId = params.vpcId;
    let clusterName = params.clusterName;
    let repositoryName = params.repositoryName;
    let desiredTaskCount = params.desiredTaskCount;
    let minTaskCount = params.minTaskCount;
    let maxTaskCount = params.maxTaskCount;

    // [step 1] Guard statement.
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
    if (
      repositoryName === undefined ||
      repositoryName === null ||
      repositoryName.trim() === ''
    ) {
      repositoryName = 'default';
    }
    if (desiredTaskCount === undefined || desiredTaskCount === null) {
      desiredTaskCount = 1;
    }
    if (minTaskCount === undefined || minTaskCount === null) {
      minTaskCount = 1;
    }
    if (maxTaskCount === undefined || maxTaskCount === null) {
      maxTaskCount = 100;
    }

    // [step 2] Get network resouce.
    const subnets = await aws.ec2.getSubnets({
      filters: [{name: 'vpc-id', values: [vpcId]}],
    });
    const securityGroups = await aws.ec2.getSecurityGroups({
      filters: [
        // Check out https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-security-groups.html
        {
          name: 'vpc-id',
          values: [vpcId],
        },
      ],
    });

    // [step 3] Create container service.
    const repository = await aws.ecr.getRepository({
      name: repositoryName,
    });

    const cluster = new aws.ecs.Cluster(clusterName);
    const lb = new awsx.lb.ApplicationLoadBalancer('nginx-lb');
    const containserServiceName = repositoryName + '-service';
    const containerService = new awsx.ecs.FargateService(
      containserServiceName,
      {
        networkConfiguration: {
          subnets: subnets.ids,
          // securityGroups: securityGroups.ids,
        },
        cluster: cluster.arn,
        desiredCount: desiredTaskCount,
        deploymentMinimumHealthyPercent: 100,
        deploymentMaximumPercent: 500,
        taskDefinitionArgs: {
          container: {
            image: repository.repositoryUrl + ':latest',
            cpu: 512,
            memory: 1024,
            essential: true,
            portMappings: [
              {
                containerPort: 80,
                targetGroup: lb.defaultTargetGroup,
              },
            ],
          },
        },
      },
      PulumiUtil.resourceOptions
    );

    // Config auto scaling for container cluster.
    const scalableTarget = 'ecs_target';
    const ecsTarget = new aws.appautoscaling.Target(
      scalableTarget,
      {
        maxCapacity: maxTaskCount,
        minCapacity: minTaskCount,
        resourceId: pulumi.interpolate`service/${cluster.name}/${containerService.service.name}`,
        scalableDimension: 'ecs:service:DesiredCount',
        serviceNamespace: 'ecs',
      },
      PulumiUtil.resourceOptions
    );

    return {
      url: lb.loadBalancer.dnsName,
    };
  };