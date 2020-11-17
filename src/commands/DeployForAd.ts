import _debug from "debug"
import nodePowershell from "node-powershell"
import path from "path"
import Vorpal from "vorpal"
import { Constants } from "../constants"
import { SdkUtil } from "../sdk/SdkUtil"
import { Base } from "./Base"

class DeployForAd extends Base {
	private readonly destination = "./.dist"
	private sdk: SdkUtil = new SdkUtil(this.config)
	constructor(private readonly vorpal: Vorpal) {
		super()
		this.vorpal
			.command("deployForAd [path]", "Create Appstream Internal Resource")
			.action((args) => this.deploy(args))
	}
	async deploy(args: Vorpal.Args) {
		this.setConfig(args)
		this.sdk = new SdkUtil(this.config)
		await this.createAppStreamImageBuilder()
	}

	private async createAppStreamImageBuilder() {
		const AppStreamImageBuilderStackPath = path.join(__dirname, "../cdk/AppStreamImageBuilderStack.js")
		await this.exec(`npx cdk deploy --app "node ${AppStreamImageBuilderStackPath}" --require-approval never -c configFile=${this.configFile}`)
		await this.execPS1("./.dist/init.ps1", "./.dist/install.ps1", "./.dist/addApp.ps1")
		await this.execPS1("./.dist/postInstall.ps1")
		await this.deleteS3Ps1Files()
		await this.finishedFileS3Upload()

	}
	
	private async deleteS3Ps1Files() {
		if (!this.config?.s3BucketUrl) throw Error("undefined s3BucketUrl")
		const { filenames } = this.getPathUrl(this.destination, this.config?.s3BucketUrl)
		const npmPack = await this.exec("npm pack")
		const npmName = npmPack.split("\n")[0]

		for (const filename of filenames) {
			this.sdk.deleteS3File(`${this.config?.s3BucketUrl}/${filename}`)
		}
		this.sdk.deleteS3File(`${this.config?.s3BucketUrl}/${npmName}`)
	}

	private async finishedFileS3Upload() {
		if (!this.config?.s3BucketUrl) throw Error("undefined s3BucketUrl")
		const { ps1Path, url } = this.getPathUrl(this.destination, this.config?.s3BucketUrl)

		const filename = "finished.ps1"
		await this.exec(`aws s3 cp ${ps1Path}/${filename} ${url}/${filename} --acl public-read`)
	}

	private async execPS1(...filenames: string[]) {

		// tslint:disable-next-line: no-non-null-assertion
		const privateIp = await this.sdk.getAppstreamEni()

		for (const filename of filenames) {
			const ps = new nodePowershell({
				executionPolicy: "Bypass",
				noProfile: true
			})
			const domainUser = `$username = 'appstream\\${Constants.AD_USERNAME}'`
			const password = `$password = ConvertTo-SecureString '${Constants.AD_PASSWORD}' -asplaintext -force`
			const cred = `$cred  = New-Object Management.Automation.PSCredential ($username, $password)`
			const execPs = `Invoke-Command -ComputerName ${privateIp} -Credential $cred ${filename}`

			try {
				await ps.addCommand(domainUser)
				await ps.addCommand(password)
				await ps.addCommand(cred)
				await ps.addCommand(execPs)
				const output = await ps.invoke()
				console.log(output)
			} catch (e) {
				console.error(e)
			}

		}

	}
}

export function deployForAd(vorpal: Vorpal) {
	return new DeployForAd(vorpal)
}
