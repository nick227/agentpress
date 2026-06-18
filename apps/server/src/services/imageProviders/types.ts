export interface ImageGenerateOptions {
  prompt: string
}

export interface ImageGenerateResult {
  url: string
}

export interface ImageProvider {
  readonly id: string
  generate(options: ImageGenerateOptions): Promise<ImageGenerateResult | null>
}
