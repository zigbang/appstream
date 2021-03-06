import * as appstream from "@aws-cdk/aws-appstream"
import * as cdk from "@aws-cdk/core"
import fs from "fs"
import moment from "moment"
import { Config } from "../config"

export class AppStreamAssociateStack extends cdk.Stack {

	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props)
	}

	async run() {
		const configFile = this.node.tryGetContext("configFile")
		const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as Config

		if (config.tags) {
			const tags = config.tags
			for (const tag of tags) {
				const cdkTags = cdk.Tags.of(this)
				cdkTags.add(tag.key, tag.value)
			}
		}

		const fleetName = `${config.fleetName}-${moment().format("YYYYMMDD")}`
		const stackName = `${config.stackName}-${moment().format("YYYYMMDD")}`
		new appstream.CfnStackFleetAssociation(this, "association", {
			fleetName,
			stackName
		})
	}
}

(async () => {
	const app = new cdk.App()
	const configFile = app.node.tryGetContext("configFile")
	const config = JSON.parse(fs.readFileSync(configFile, "utf8")) as Config
	const stack = new AppStreamAssociateStack(app, `AppStream-AssociateFleet-${config.imageName}`)
	await stack.run()
})().then(() => { })
