declare module 'markdown-it-container' {
  interface ContainerToken {
    nesting: number
    info: string
  }

  interface ContainerOptions {
    render?: (tokens: ContainerToken[], idx: number) => string
    validate?: (params: string) => boolean
    marker?: string
  }

  const plugin: (
    md: unknown,
    name: string,
    options: ContainerOptions,
  ) => void

  export default plugin
}
