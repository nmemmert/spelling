const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: process.env.APP_NAME || 'spelling-practice',
    version: process.env.APP_VERSION || '3.0.0'
  },
  transports: [
    // File transport for all logs
    new winston.transports.File({ 
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // File transport for errors only
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    // Only log errors and warnings, not successful requests
    if (res.statusCode >= 400) {
      if (res.statusCode >= 500) {
        logger.error('HTTP Request', logData);
      } else {
        logger.warn('HTTP Request', logData);
      }
    }
  });
  
  next();
};

// Security event logger
const securityLogger = {
  loginAttempt: (username, ip, success) => {
    logger.info('Login Attempt', {
      event: 'auth_attempt',
      username,
      ip,
      success,
      timestamp: new Date().toISOString()
    });
  },
  
  rateLimitHit: (ip, endpoint) => {
    logger.warn('Rate Limit Hit', {
      event: 'rate_limit',
      ip,
      endpoint,
      timestamp: new Date().toISOString()
    });
  },
  
  suspiciousActivity: (details) => {
    logger.error('Suspicious Activity', {
      event: 'security_alert',
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  logger,
  requestLogger,
  securityLogger
};