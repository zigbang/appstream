import _debug from "debug"
import path from "path"
import Vorpal from "vorpal"

import { Base } from "./Base"

class Destroy extends Base {

	constructor(private readonly vorpal: Vorpal) {
		super()
		this.vorpal
			.command("destroy [path]", "Delete All Appstream Resource")
			.action((args) => this.destroy(args))
	}
	async destroy(args: Vorpal.Args) {
		this.setConfig(args)
		const AppStreamAssociateStackPath = path.join(__dirname, "../cdk/AppStreamAssociateStack.js")
		const AppstreamFleetStackPath = path.join(__dirname, "../cdk/AppstreamFleetStack.js")
		await this.exec(`npx cdk destroy --app "${AppStreamAssociateStackPath}" --require-approval never -c configFile=${this.configFile} --force`)
		await this.exec(`npx cdk destroy --app "${AppstreamFleetStackPath}" --require-approval never -c configFile=${this.configFile} --force`)
	}
}

export function destroy(vorpal: Vorpal) {
	return new Destroy(vorpal)
}
