export type PublishProgressReporter = (message: string) => Promise<void>

async function noopPublishProgress(_message: string): Promise<void> {}
