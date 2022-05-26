import * as aws from "@pulumi/aws"
import * as awsx from "@pulumi/awsx"
import * as pulumi from "@pulumi/pulumi"
import { getCertificateValidation } from "./certificate"

const config = new pulumi.Config()
const APP = config.require("name")
const DOMAIN = config.require("domain")
const SUB_DOMAIN = config.require("subDomain")
const APP_DOMAIN = `${SUB_DOMAIN}.${DOMAIN}`
const APP_MEMORY = config.requireNumber("memory")

const STREAMLIT_PORT = 8501

const sg = new awsx.ec2.SecurityGroup(`${APP}-sg`)

// Open egress traffic to your load balancer (for health checks).
sg.createEgressRule("healthcheck", {
  protocol: "-1",
  fromPort: 0,
  toPort: 0,
  cidrBlocks: ["0.0.0.0/0"],
})

sg.createIngressRule("streamlit", {
  protocol: "tcp",
  fromPort: STREAMLIT_PORT,
  toPort: STREAMLIT_PORT,
  cidrBlocks: ["0.0.0.0/0"],
})

export const securityGroupId = sg.id

//// Within the created VPC, create a new ALB and an ECS cluster
const alb = new awsx.lb.ApplicationLoadBalancer(`${APP}-alb`, {
  securityGroups: [sg],
})

const cluster = new awsx.ecs.Cluster(`${APP}-cluster`, {
  securityGroups: [sg],
})

//// Define single target group for UI/API
const targetGroupArgs = (
  port: number,
  healthCheckPath: string
): awsx.lb.ApplicationTargetGroupArgs => {
  return {
    protocol: "HTTP",
    port: port,
    healthCheck: { path: healthCheckPath },
  }
}

const stTargetGroup = alb.createTargetGroup(
  `${APP}-tg`,
  targetGroupArgs(STREAMLIT_PORT, "/")
)

const httpListener = alb.createListener(`${APP}-http-listener`, {
  port: 80,
  protocol: "HTTP",
  defaultAction: {
    type: "redirect",
    redirect: {
      protocol: "HTTPS",
      port: "443",
      statusCode: "HTTP_301",
    },
  },
})

const httpsListener = alb.createListener(`${APP}-https-listener`, {
  // vpc: vpc,
  protocol: "HTTPS",
  certificateArn: getCertificateValidation(APP_DOMAIN, DOMAIN).certificateArn,
  port: 443,
  targetGroup: stTargetGroup,
})

export const albEndPoint = httpsListener.endpoint.hostname

//// Route53 record aliasing to ALB
const _ = new aws.route53.Record(APP_DOMAIN, {
  name: SUB_DOMAIN,
  zoneId: aws.route53.getZone({ name: DOMAIN }).then((zone) => zone.zoneId),
  type: "A",
  aliases: [
    {
      name: alb.loadBalancer.dnsName,
      zoneId: alb.loadBalancer.zoneId,
      evaluateTargetHealth: true,
    },
  ],
})

//// Client task definition & service
const stRepo = new awsx.ecr.Repository(`${APP}-repo`)
const stImage = stRepo.buildAndPushImage({
  context: "../",
  extraOptions: ["--platform", "linux/amd64"],
})

const stTaskDefinition = new awsx.ecs.FargateTaskDefinition(`${APP}-td`, {
  container: {
    image: stImage,
    memory: APP_MEMORY,
    portMappings: [stTargetGroup],
  },
  logGroup: new aws.cloudwatch.LogGroup(`${APP}-log`),
})

const stService = new awsx.ecs.FargateService(`${APP}-service`, {
  cluster,
  taskDefinition: stTaskDefinition,
  desiredCount: 1,
})
