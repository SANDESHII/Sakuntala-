/// <reference types="vite/client" />
interface ImportMetaEnv {
    readonly VITE_API_FOOTBALL_KEY: string
    readonly VITE_ODDS_API_KEY: string
}
interface ImportMeta {
    readonly env: ImportMetaEnv
}
