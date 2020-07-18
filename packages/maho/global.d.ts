declare namespace NodeJS {
  interface Process {
    /** Detect if the code is running in browser */
    readonly browser: boolean
  }

  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production'
  }
}
