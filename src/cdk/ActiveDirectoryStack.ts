import * as appstream from "@aws-cdk/aws-appstream"
import * as ec2 from "@aws-cdk/aws-ec2"
import * as iam from "@aws-cdk/aws-iam"
import * as route53 from "@aws-cdk/aws-route53"
import * as cdk from "@aws-cdk/core"
import fs from "fs"
import { URL } from "url"
import * as ip from "what-is-my-ip-address"
import { Config } from "../config"
import { Constants } from "../constants"

export class ActiveDirectoryStack extends cdk.Stack {

	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props)
	}

	async run() {
		const configFile = this.node.tryGetContext("configFile")
		const packageFile = this.node.tryGetContext("packageFile")
		const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as Config
		const packages = JSON.parse(fs.readFileSync(packageFile, "utf8"))

		// vpc
		const availabilityZones = [config.availabilityZone]
		const vpc = ec2.Vpc.fromVpcAttributes(this, "appstream-vpc", {
			vpcId: config.vpc,
			availabilityZones,					// TODO 하나 이상이어야 하지 않을까?
			publicSubnetIds: [config.subnet]	// TODO array인데 하나 이상이어야 하지 않을까?
		})

		// sg
		const securityGroup = new ec2.SecurityGroup(this, "appstream-security-group", {
			vpc, allowAllOutbound: true
		})
		const subnetId = ec2.Subnet.fromSubnetAttributes(this, "subnet", { subnetId: config.subnet, ipv4CidrBlock: config.cidr })

		securityGroup.addIngressRule(ec2.Peer.ipv4(`${await ip.v4()}/32`), ec2.Port.tcp(3389), "RDP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.allTraffic(), "Allow All")	// TODO CIDR block lookup

		// role
		const assumedBy = new iam.ServicePrincipal("ec2.application-autoscaling.amazonaws.com")
		const effect = iam.Effect.ALLOW
		const resources = ["*"]
		const actions = [
			"ec2:DescribeSpotFleetRequests",
			"ec2:ModifySpotFleetRequest",
			"cloudwatch:DescribeAlarms",
			"cloudwatch:PutMetricAlarm",
			"cloudwatch:DeleteAlarms",
			"s3:Get*",
			"s3:List*"
		]
		const role = new iam.Role(this, "AppstreamEC2SpotFleetAutoscaleRole", {
			assumedBy
		})
		role.addToPolicy(
			new iam.PolicyStatement({
				effect,
				resources,
				actions
			})
		)
		role.addToPolicy(
			new iam.PolicyStatement({
				effect,
				resources: ["arn:aws:iam::*:role/aws-service-role/ec2.application-autoscaling.amazonaws.com/AWSServiceRoleForApplicationAutoScaling_EC2SpotFleetRequest"],
				actions: ["iam:CreateServiceLinkedRole"]
			})
		)

		// ec2
		const machineImage = ec2.MachineImage.latestWindows(ec2.WindowsVersion.WINDOWS_SERVER_2019_KOREAN_FULL_BASE)
		const subnets = vpc.publicSubnets.filter((s) => s.subnetId === config.subnet)
		const vpcSubnets = vpc.selectSubnets({ subnets, availabilityZones })
		const ec2Instance = new ec2.Instance(this, "ActiveDirectory", {
			vpc, vpcSubnets,
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
			machineImage,
			keyName: config.keyPair,
			securityGroup,
			role
		})
		const filenames = fs.readdirSync(process.env.PWD as string + "/.dist/").filter((value) => value.startsWith("phase"))
		const npmName = fs.readdirSync(process.env.PWD as string).filter((value) => value.endsWith("tgz"))
		const url = new URL(config.s3BucketUrl)
		for (const filename of filenames) {
			const target = `https://${url.host}.s3-${config.awsRegion}.amazonaws.com${url.pathname}/${filename}`
			ec2Instance.userData.addCommands(`Invoke-WebRequest -outfile C:/${filename} ${target}`)
		}
		const npmFile = `${packages.name}-${packages.version}.tgz`
		const target2 = `https://${url.host}.s3-${config.awsRegion}.amazonaws.com${url.pathname}/${npmFile}`
		ec2Instance.userData.addCommands(`Invoke-WebRequest -outfile C:/${npmFile} ${target2}`)
		ec2Instance.userData.addCommands(`C:/phase1.ps1`)

		// route 53
		const zone = new route53.PrivateHostedZone(this, "appstream-route53", {
			vpc, zoneName: Constants.DIRECTORY_NAME
		})
		new route53.ARecord(this, "appstream A record 1", {
			zone, recordName: Constants.DIRECTORY_NAME,
			target: route53.RecordTarget.fromIpAddresses(ec2Instance.instancePrivateIp)
		})
		new route53.ARecord(this, "appstream A record 2", {
			zone, recordName: `${Constants.AD_SERVER_NAME}.${Constants.DIRECTORY_NAME}`,
			target: route53.RecordTarget.fromIpAddresses(ec2Instance.instancePrivateIp)
		})
		new route53.SrvRecord(this, "appstream SRV Record", {
			zone, recordName: `_ldap._tcp.dc._msdcs.${Constants.DIRECTORY_NAME}`,
			values: [{
				priority: 10,
				weight: 100,
				port: 389,
				hostName: `${Constants.AD_SERVER_NAME}.${Constants.DIRECTORY_NAME}`
			}]
		})

		// ad directory config
		const directoryName = Constants.DIRECTORY_NAME
		const values = directoryName.split(".")
		const organizationalUnitDistinguishedNames = [`OU=${values[0]},${values.map((value) => `DC=${value}`).join(",")}`]
		const accountName = `${Constants.DIRECTORY_NAME}\\${Constants.AD_USERNAME}`
		const accountPassword = Constants.AD_PASSWORD

		new appstream.CfnDirectoryConfig(this, "appstream-ad", {
			directoryName, organizationalUnitDistinguishedNames,
			serviceAccountCredentials: { accountName, accountPassword }
		})

		// output
		new cdk.CfnOutput(this, "appstream-ad-sg-id", {
			exportName: Constants.AD_SECURITY_GROUP_NAME,
			value: securityGroup.securityGroupId
		})
	}
}

(async () => {
	const app = new cdk.App()
	const stack = new ActiveDirectoryStack(app, "AppStream")
	await stack.run()
})().then(() => { })