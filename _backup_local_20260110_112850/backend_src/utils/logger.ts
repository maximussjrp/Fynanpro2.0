/**
 * Sistema de Logging Profissional com Winston
 * Substitui console.log por logging estruturado com níveis e rotação
 */

import winston from 'winston';

// Definir níveis customizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Cores para cada nível
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(colors);

// Formato para console (desenvolvimento)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Formato para arquivo (produção)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transportes (onde os logs vão)
const transports: winston.transport[] = [
  // Console sempre ativo
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Em produção, adicionar arquivos de log
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // Logs gerais
    new winston.transports.File({
      filename: 'logs/app.log',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Apenas erros
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Criar logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  transports,
  exitOnError: false,
});

// Helper functions para facilitar uso
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  http: (message: string, meta?: any) => logger.http(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
};

// Middleware para logar requisições HTTP
export function httpLogger(req: any, res: any, next: any) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      log.error('HTTP Request', logData);
    } else if (res.statusCode >= 400) {
      log.warn('HTTP Request', logData);
    } else {
      log.http('HTTP Request', logData);
    }
  });

  next();
}

export default logger;
