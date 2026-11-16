export const logger = {
  error: (context: string, error: unknown, metadata?: Record<string, unknown>) => {
    console.error(`[AlphaTerminal] ERROR | ${context}:`, {
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      ...metadata
    });
  },
  warn: (context: string, message: string) => {
    console.warn(`[AlphaTerminal] WARN  | ${context}: ${message}`);
  },
  info: (context: string, message: string) => {
    console.info(`[AlphaTerminal] INFO  | ${context}: ${message}`);
  },
  debug: (context: string, message: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[AlphaTerminal] DEBUG | ${context}: ${message}`);
    }
  }
};
