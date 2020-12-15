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

		if (config.awsTag) {
			const tag = cdk.Tags.of(this)
			tag.add("Service", config.awsTag.service)
			tag.add("Team", config.awsTag.team)
			tag.add("User", config.awsTag.user)
			tag.add("Environment", config.awsTag.environment)
		}

		// vpc
		const availabilityZones = [config.availabilityZone]
		const vpc = ec2.Vpc.fromVpcAttributes(this, "appstream-vpc", {
			vpcId: config.vpc,
			availabilityZones,					// TODO 하나 이상이어야 하지 않을까?
			publicSubnetIds: [config.subnet]	// TODO array인데 하나 이상이어야 하지 않을까?
		})

		const subnetIds = [config.subnet]
		const desiredInstances = config.fleetDesiredInstances || 5
		const instanceType = config.instanceType
		const name = `${config.fleetName}-${moment().format("YYYYMMDD")}`
		const enableDefaultInternetAccess = config.fleetEnableDefaultInternetAccess || true
		const sdk = new SdkUtil(config)
		const fleetType = config.fleetType || "ON_DEMAND"
		const imageArn = await sdk.describeAppstreamImageArn()

		if (!config.fleetSecurityGroupId) {
			const securityGroup = new ec2.SecurityGroup(this, "Fleet-Security-Group", {
				vpc, allowAllOutbound: config.fleetEnableDefaultInternetAccess || true
			})
			config.fleetSecurityGroupId = securityGroup.securityGroupId
		}
		const securityGroupIds = [config.fleetSecurityGroupId]
		new appstream.CfnFleet(this, "Fleet", {
			computeCapacity: { desiredInstances }, instanceType, name,
			enableDefaultInternetAccess, fleetType, imageArn,
			vpcConfig: { securityGroupIds, subnetIds }
		})


		const stackName = `${config.stackName}-${moment().format("YYYYMMDD")}`
		const connectorType = config.storageConnectorType
		const domains = config.connectorDomains || undefined

		if (connectorType === "ONE_DRIVE" || connectorType === "GOOGLE_DRIVE" || connectorType === "HOMEFOLDERS") {
			new appstream.CfnStack(this, "stack", {
				name: stackName,
				storageConnectors: [{ connectorType, domains }]
			})
		} else {
			new appstream.CfnStack(this, "stack", {
				name: stackName
			})
		}

	}
}

(async () => {
	const app = new cdk.App()
	const configFile = app.node.tryGetContext("configFile")
	const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as Config
	const stack = new AppstreamFleetStack(app, `AppStreamFleetStack-${config.imageName}`)
	await stack.run()
})().then(() => { })
