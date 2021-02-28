import winston from 'winston';
import { createLogger, transports, format } from 'winston';

const { combine, timestamp, label, printf } = format;

const loggerFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export const getLogger = (lbl: string): winston.Logger => {
  const logger = createLogger({
    format: combine(label({ label: lbl }), timestamp(), loggerFormat),
    transports: [new transports.Console()],
  });
  return logger;
};
