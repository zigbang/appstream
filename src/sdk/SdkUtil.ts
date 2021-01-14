import * as sdk from "aws-sdk"
// tslint:disable-next-line: no-duplicate-imports
import moment from "moment"
import { Config } from "../config"

export class SdkUtil {
	private readonly config?: Config
	private readonly appstream: sdk.AppStream
	private readonly s3: sdk.S3
	private readonly cloudformation: sdk.CloudFormation
	constructor(config: Config | undefined) {
		this.config = config
		if (config) {
			sdk.config.update({
				region: config.awsRegion
			})
		}
		this.appstream = new sdk.AppStream()
		this.s3 = new sdk.S3()
		this.cloudformation = new sdk.CloudFormation()
	}

	async checkCloudformation(stackName: string): Promise<boolean> {
		try {
			const result = await this.cloudformation.describeStacks({ StackName: stackName }).promise()
			if (!result.Stacks) return false
			const stack = result.Stacks[0]
			if (stack.StackStatus === "CREATE_COMPLETE" || stack.StackStatus === "UPDATE_COMPLETE") {
				console.log(stackName, stack.StackStatus)
				return true
			}
		} catch (e) {
		}
		return false
	}

	async getS3File(bucketFileUrl: string): Promise<any> {
		let rtn
		// ex) s3://xxxx/appstream/finished.ps1
		const { Bucket, Key } = this.s3UrlParse(bucketFileUrl)
		try {
			rtn = await this.s3.getObject({
				Bucket,
				Key
			}).promise()
		} catch (e) {
		}
		return rtn
	}

	async deleteS3File(bucketFileUrl: string): Promise<any> {
		let rtn
		const { Bucket, Key } = this.s3UrlParse(bucketFileUrl)
		try {
			rtn = await this.s3.deleteObject({
				Bucket,
				Key
			}).promise()
		} catch (e) {
		}
		return rtn
	}

	async describeImage(): Promise<any> {
		try {
			const data = await this.appstream.describeImages().promise()
			const result = JSON.stringify((data).Images)
			const images = JSON.parse(result)
			const winSvr = images.filter((list: any) => {
				return list.Name.includes(this.config?.baseImage || "AppStream-WinServer2019")
			})
			const result2 = Object.keys(winSvr)
				.sort((a, b) => Date.parse(winSvr[b].PublicBaseImageReleasedDate) - Date.parse(winSvr[a].PublicBaseImageReleasedDate))
				.map((k) => (winSvr[k]))
			const winSvrLatestImage: any = result2[0]
			const winSvrLatestImageArn = winSvrLatestImage["Arn"]
			return winSvrLatestImageArn as string
		} catch (err) {
			console.log(err, err.stack)
			return undefined
		}
	}

	async getAppstreamEni() {
		const Names = [`${this.config?.imageBuilderName}-${moment().format("YYYYMMDD")}`]
		const data = await this.appstream.describeImageBuilders({ Names }).promise()
		const eniIp = data.ImageBuilders?.map((i) => {
			return i.NetworkAccessConfiguration?.EniPrivateIpAddress
		})
		if (!eniIp) throw new Error("undefined ImageBuilder Private IP")
		return eniIp?.join(".")
	}

	async describeAppstreamImageArn() {
		const Names = [`${this.config?.imageName}-${moment().format("YYYYMMDD")}`]
		const data = await this.appstream.describeImages({ Names }).promise()
		const imageArn = data.Images?.map((i) => {
			return i.Arn
		})
		if (!imageArn) throw new Error("undefined Image Arn")
		console.log(imageArn.toString())
		return imageArn.toString()
	}

	async describeAppstreamImageState(): Promise<any> {
		try {
			const Names = [`${this.config?.imageName}-${moment().format("YYYYMMDD")}`]
			const data = await this.appstream.describeImages({ Names }).promise()
			const statusImage = data.Images?.map((i) => {
				return i.State
			})
			if (!statusImage) {
				console.error("undefined Image")
				return undefined
			}
			return statusImage.toString()
		} catch (err) {
			console.log(err, err.stack)
			return undefined
		}
	}

	async startAppstreamFleet(): Promise<any> {
		const Name = `${this.config?.fleetName}-${moment().format("YYYYMMDD")}`
		const start = await this.appstream.startFleet({ Name }).promise()
		return start
	}

	async appstreamFleetState(): Promise<any> {
		const Names = [`${this.config?.fleetName}-${moment().format("YYYYMMDD")}`]
		const data = await this.appstream.describeFleets({ Names }).promise()
		const statusFleet = data.Fleets?.map((i) => {
			return i.State
		})
		if (!statusFleet) throw new Error("undefined Fleet")
		console.log(statusFleet.toString())
		return statusFleet.toString()
	}

	async appstreamCreateUrl(): Promise<any> {
		try {
			const StackName = `${this.config?.stackName}-${moment().format("YYYYMMDD")}`
			const FleetName = `${this.config?.fleetName}-${moment().format("YYYYMMDD")}`
			const params = {
				StackName,
				FleetName,
				UserId: "edward"
			}
			const data = await this.appstream.createStreamingURL(params).promise()
			console.log(data)
			return data

		} catch (e) {
			console.log(e)
			return undefined
		}
	}
	private readonly s3UrlParse = (bucketFileUrl: string) => {
		const parseArr = bucketFileUrl.split("//")
		const idx = parseArr[1].indexOf("/")
		const Bucket = parseArr[1].substring(0, idx)
		const Key = parseArr[1].substring(idx + 1, parseArr[1].length)
		return { Bucket, Key }
	}
}