import * as appstream from "@aws-cdk/aws-appstream"
import * as cdk from "@aws-cdk/core"
import fs from "fs"
import moment from "moment"
// tslint:disable-next-line: no-duplicate-imports
import { SdkUtil } from "../sdk/SdkUtil"
import { Constants } from "../constants"
import { Config } from "../Config"


export class AppStreamImageBuilderStack extends cdk.Stack {

	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props)
	}
	async run() {
		const configFile = this.node.tryGetContext("configFile")
		const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as Config
		const sdk = new SdkUtil(config)

		if (config.awsTag) {
			const tag = cdk.Tags.of(this)
			tag.add("Service", config.awsTag.service)
			tag.add("Team", config.awsTag.team)
			tag.add("User", config.awsTag.user)
			tag.add("Environment", config.awsTag.environment)
		}

		const imageArn = await sdk.describeImage()
		const instanceType = config.instanceType
		const name = `${config.imageBuilderName}-${moment().format("YYYYMMDD")}`
		const securityGroupIds = [cdk.Fn.importValue(Constants.AD_SECURITY_GROUP_NAME)]

		const directoryName = Constants.DIRECTORY_NAME

		const values = directoryName.split(".")
		const organizationalUnitDistinguishedName = `OU=${values[0]},${values.map((value) => `DC=${value}`).join(",")}`
		console.log(organizationalUnitDistinguishedName)
		const subnetIds = [config.subnet]

		new appstream.CfnImageBuilder(this, "appstream", {
			instanceType, name, imageArn,
			domainJoinInfo: { directoryName, organizationalUnitDistinguishedName },
			enableDefaultInternetAccess: true,
			vpcConfig: { securityGroupIds, subnetIds }
		})
	}
}

(async () => {
	const app = new cdk.App()
	const configFile = app.node.tryGetContext("configFile")
	const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as Config
	const stack = new AppStreamImageBuilderStack(app, `AppStreamImageBuilderStack-${config.imageName}`)
	await stack.run()
})().then(() => { })
