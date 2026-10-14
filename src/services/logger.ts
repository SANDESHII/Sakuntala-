export const logger = {
  error: (context: string, error: any, metadata?: any) => {
    console.error(`[AlphaTerminal] ${context}:`, {
      message: error instanceof Error ? error.message : String(error),
      status: error?.status,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  },
  warn: (context: string, message: string) => {
    console.warn(`[AlphaTerminal] ${context}: ${message}`);
  }
};
