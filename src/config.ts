export interface Config {
	awsAccessKeyId: string
	awsSecretAccessKey: string
	awsRegion: string
	vpc: string
	availabilityZone: string
	subnet: string
	cidr: string
	keyPair?: string
	s3BucketUrl: string
	applications: Application[]
	imageBuilderName: string
	imageName: string
	fleetName: string
	stackName: string
	instanceType: string
}

export interface Application {
	id: string
	packageName: string
	path: string
	displayName: string
}
