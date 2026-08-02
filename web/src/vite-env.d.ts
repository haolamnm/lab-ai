/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Python planning backend. Unset means run the planner locally. */
  readonly VITE_API_URL?: string
}
