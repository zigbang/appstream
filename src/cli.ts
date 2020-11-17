import Vorpal from "vorpal"
import * as commands from "./commands"

const vorpal = new Vorpal().delimiter("appstream~$")

export function run() {
	vorpal.use(commands.deploy)
	vorpal.use(commands.deployForAd)
	vorpal.use(commands.destroy)

	if (isInteractive()) {
		vorpal.show()
	} else {
		vorpal.delimiter("")
		vorpal.parse(process.argv)
	}
}

function isInteractive() {
	return process.argv.length <= 2
}
