import fs from "fs"
import path from "path"
import shelljs from "shelljs"
import { URL } from "url"
import Vorpal from "vorpal"
import { Config } from "../config"

export abstract class Base {

	config?: Config

	configFile?: string

	setConfig(args: Vorpal.Args) {
		this.configFile = args.path as string ?? "./config.json"
		try {
			this.config = JSON.parse(fs.readFileSync(this.configFile, "utf8"))
		} catch (e) {
			console.error(e)
			throw Error("Config file not found. Check config file or config path")
		}
	}

	getPathUrl(destination: string, s3BucketUrl: string) {
		const ps1Path = path.join(destination)
		const url = new URL(s3BucketUrl)
		const filenames = fs.readdirSync(ps1Path).filter((value) => value.startsWith("phase"))
		return {
			ps1Path,
			url,
			filenames
		}
	}
	async exec(cmd: string, option: shelljs.ExecOptions = {}) {
		shelljs.echo(`> ${cmd}`)
		return new Promise<string>((resolve, reject) => {
			shelljs.exec(cmd, option, (code, stdout, stderr) => {
				if (code !== 0) return reject(new Error(stderr))
				return resolve(stdout)
			})
		})
	}

	async sleep(ms: number) {
		return new Promise((resolve) => {
			setTimeout(() => resolve(), ms)
		})
	}
}
