export type PublishProgressReporter = (message: string) => Promise<void>

export async function noopPublishProgress(_message: string): Promise<void> {}
