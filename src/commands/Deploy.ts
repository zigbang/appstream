import _debug from "debug"
import fs from "fs"
import nunjucks from "nunjucks"
import path from "path"
import Vorpal from "vorpal"
import { Constants } from "../constants"
import { SdkUtil } from "../sdk/SdkUtil"
import { Base } from "./Base"

class Deploy extends Base {
	private readonly destination = "./.dist"
	private sdk: SdkUtil = new SdkUtil(this.config)
	constructor(private readonly vorpal: Vorpal) {
		super()

		this.vorpal
			.command("deploy [path]", "Create All Appstream Resource")
			.action((args) => this.deploy(args))
	}

	async deploy(args: Vorpal.Args) {
		this.setConfig(args)
		this.sdk = new SdkUtil(this.config)
		this.clearScripts()
		this.createAdScripts()
		this.createBuilderScripts()
		await this.createActiveDirectory()          // 25분
		await this.createAppstreamFleet()			// 25분
		await this.associateAppstream()		// 15분
		const AppStreamImageBuilderStackPath = path.join(__dirname, "../cdk/AppStreamImageBuilderStack.js")
		const activeDirectoryStackPath = path.join(__dirname, "../cdk/ActiveDirectoryStack.js")
		await this.exec(`npx cdk destroy --app "${AppStreamImageBuilderStackPath}" --require-approval never  -c configFile=${this.configFile} --force`)
		await this.exec(`npx cdk destroy --app "${activeDirectoryStackPath}" --require-approval never  -c configFile=${this.configFile} --force`)
	}
	private clearScripts() {
		this.deleteFolderRecursive(this.destination)
		fs.mkdirSync(this.destination)
	}
	/**
	 * for active directory
	 */
	private createAdScripts() {
		const adTemplate = path.join(__dirname, "../template/ad")
		const adFilenames = fs.readdirSync(adTemplate)
		const packages = require(path.join(process.env.PWD as string, "package.json"))
		const npmFile = `${packages.name}-${packages.version}.tgz`
		nunjucks.configure(adTemplate, { tags: { variableStart: "#{", variableEnd: "}" }, autoescape: false })
		console.log("npmFile", npmFile)
		const context = {
			...this.config, AD_SERVER_NAME: Constants.AD_SERVER_NAME,
			DIRECTORY_NAME: Constants.DIRECTORY_NAME, AD_USER_NAME: Constants.AD_USERNAME, AD_PASSWORD: Constants.AD_PASSWORD,
			DIRECTORY_NAME_DC: Constants.DIRECTORY_NAME.split(".").map((v) => `DC=${v}`).join(","), NPM_FILE: npmFile, CONFIG_FILE: this.configFile
		}
		for (const filename of adFilenames) {
			const output = nunjucks.render(filename, context)
			fs.writeFileSync(path.join(this.destination, filename), output, "utf8")
		}
	}
	/**
	 * for image builder directory
	 */
	private createBuilderScripts() {
		const builderTemplate = path.join(__dirname, "../template/builder")
		const builderFilenames = fs.readdirSync(builderTemplate)
		nunjucks.configure(builderTemplate, { tags: { variableStart: "#{", variableEnd: "}" } })
		const context = { ...this.config, DIRECTORY_NAME_DC: Constants.DIRECTORY_NAME.split(".").map((v) => `DC=${v}`).join(",") }
		for (const filename of builderFilenames) {
			const output = nunjucks.render(filename, context)
			fs.writeFileSync(path.join(this.destination, filename), output, "utf8")
		}
	}

	private deleteFolderRecursive(path: string) {
		if (fs.existsSync(path)) {
			const self = this
			fs.readdirSync(path).forEach((file) => {
				const curPath = `${path}/${file}`
				if (fs.lstatSync(curPath).isDirectory()) {
					self.deleteFolderRecursive(curPath)
				} else { // delete file
					fs.unlinkSync(curPath)
				}
			})
			fs.rmdirSync(path)
		}
	}

	private async createActiveDirectory() {
		if (!this.config?.s3BucketUrl) throw Error("undefined s3BucketUrl")
		const { ps1Path, url, filenames } = this.getPathUrl(this.destination, this.config?.s3BucketUrl)
		const npmPack = await this.exec("npm pack")
		const npmName = npmPack.split("\n")[0]

		for (const filename of filenames) {
			await this.exec(`aws s3 cp ${ps1Path}/${filename} ${url}/${filename} --acl public-read`)
		}
		await this.exec(`aws s3 cp ${npmName} ${url}/${npmName} --acl public-read`)
		// CDK
		const activeDirectoryStackPath = path.join(__dirname, "../cdk/ActiveDirectoryStack.js")
		// tslint:disable-next-line: no-non-null-assertion
		const configFile = path.join(process.env.PWD as string, this.configFile!)
		const packageFile = path.join(process.env.PWD as string, "package.json")
		console.log("packageFile", packageFile)
		this.sdk.deleteS3File(`${this.config?.s3BucketUrl}/finished.ps1`)
		await this.exec(`npx cdk deploy --app "${activeDirectoryStackPath}" --require-approval never -c configFile=${configFile} -c packageFile=${packageFile}`)
	}

	private async createAppstreamFleet() {
		console.log("> wait for AppStream Stack")
		while (!(await this.sdk.checkCloudformation("AppStream") && await this.sdk.checkCloudformation("AppStreamImageBuilderStack"))) {
			await this.sleep(1000 * 60 * 1)
		}

		while (!this.sdk.getS3File(`${this.config?.s3BucketUrl}/finished.ps1`)) {
			await this.sleep(1000 * 60 * 1)
			console.log("> wait for AppStream ImageBuilder Setup")
		}
		// image builder setup wait 추후에 이거 체크 하는 로직 개발 필요.
		console.log("> create AppStream Fleet")
		const state = ""
		for (let i = 0; i < 100; i++) {

			const state = await this.sdk.describeAppstreamImageState()

			if (state === "AVAILABLE") {
				const AppstreamFleetStackPath = path.join(__dirname, "../cdk/AppstreamFleetStack.js")
				await this.exec(`npx cdk deploy --app "${AppstreamFleetStackPath}" --require-approval never -c configFile=${this.configFile}`)
				await this.sdk.startAppstreamFleet()
				return
			} else {
				console.log("AppStream ImageBuilder Snapshotting")
				await this.sleep(1000 * 60 * 1) // 1분
			}
		}
		throw new Error(state)
	}

	private async associateAppstream() {
		const state = ""
		for (let i = 0; i < 100; i++) {

			const state = await this.sdk.appstreamFleetState()

			if (state === "RUNNING") {
				const AppStreamAssociateStackPath = path.join(__dirname, "../cdk/AppStreamAssociateStack.js")
				await this.exec(`npx cdk deploy --app "${AppStreamAssociateStackPath}" --require-approval never -c configFile=${this.configFile}`)
				await this.sdk.appstreamCreateUrl()
				return
			} else {
				await this.sleep(1000 * 60 * 1) // 1분
			}
		}
		throw new Error(state)
	}
}
export function deploy(vorpal: Vorpal) {
	return new Deploy(vorpal)
}
