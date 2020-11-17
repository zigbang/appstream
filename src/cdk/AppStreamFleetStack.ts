import * as appstream from "@aws-cdk/aws-appstream"
import * as ec2 from "@aws-cdk/aws-ec2"
import * as cdk from "@aws-cdk/core"
import fs from "fs"
import moment from "moment"
import { Config } from "../config"
import { SdkUtil } from "../sdk/SdkUtil"

export class AppstreamFleetStack extends cdk.Stack {

	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props)
	}

	async run() {
		const configFile = this.node.tryGetContext("configFile")
		const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as Config

		// vpc
		const availabilityZones = [config.availabilityZone]
		const vpc = ec2.Vpc.fromVpcAttributes(this, "appstream-vpc", {
			vpcId: config.vpc,
			availabilityZones,					// TODO 하나 이상이어야 하지 않을까?
			publicSubnetIds: [config.subnet]	// TODO array인데 하나 이상이어야 하지 않을까?
		})

		const securityGroup = new ec2.SecurityGroup(this, "Fleet-EC2", {
			vpc, allowAllOutbound: true
		})

		const subnetId = ec2.Subnet.fromSubnetAttributes(this, "subnet", { subnetId: config.subnet, ipv4CidrBlock: config.cidr })
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcp(53), "DNS TCP")	// TODO CIDR block lookup
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.udp(53), "DNS UDP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcp(88), "Kerberos authentication TCP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.udp(88), "Kerberos authentication UDP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.udp(123), "NTP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcp(135), "RPC")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.udpRange(137, 138), "Netlogon UDP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcp(138), "Netlogon TCP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcp(389), "LDAP TCP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.udp(389), "LDAP UDP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcp(445), "SMB TCP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.udp(445), "SMB UDP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcp(80), "HTTP")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcp(443), "HTTPS")
		securityGroup.addIngressRule(ec2.Peer.ipv4(`${subnetId.ipv4CidrBlock}`), ec2.Port.tcpRange(1024, 65535), "HTTP")

		const subnetIds = [config.subnet]
		const instanceType = config.instanceType
		const name = `${config.fleetName}-${moment().format("YYYYMMDD")}`
		const sdk = new SdkUtil(config)
		const imageArn = await sdk.describeAppstreamImageArn()
		const securityGroupIds = [securityGroup.securityGroupId]

		new appstream.CfnFleet(this, "Fleet", {
			computeCapacity: { desiredInstances: 5 }, instanceType, name,
			enableDefaultInternetAccess: true,
			fleetType: "ON_DEMAND", imageArn,
			vpcConfig: { securityGroupIds, subnetIds }
		})

		const stackName = `${config.stackName}-${moment().format("YYYYMMDD")}`
		new appstream.CfnStack(this, "stack", { name: stackName })
	}
}

(async () => {
	const app = new cdk.App()
	const stack = new AppstreamFleetStack(app, "AppStreamFleetStack")
	await stack.run()
})().then(() => { })
