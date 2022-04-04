declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      REDIS_URL: string;
      PORT: string;
      SESSION_SECRET: string;
      CORS_ORIGIN: string;
      MOBILE_CORS_ORIGIN: string;
      TOKEN_SECRET: string;
    }
  }
}

export {}
