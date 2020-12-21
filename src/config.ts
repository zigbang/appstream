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
	imageBuilderName: string
	baseImage?: string
	imageName: string
	fleetName: string
	fleetEnableDefaultInternetAccess?: boolean
	fleetSecurityGroupId?: string
	fleetDesiredInstances?: number
	fleetType?: string
	stackName: string
	instanceType: string
	storageConnectorType?: string
	connectorDomains?: string[]
	tags?: Tag[]
	applications: Application[]
	scripts?: string[]
}

export interface Tag {
	key: string
	value: string
}

export interface Application {
	id: string
	packageName: string
	path: string
	displayName: string
}