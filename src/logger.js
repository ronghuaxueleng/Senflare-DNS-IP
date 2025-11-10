const winston = require('winston');
const path = require('path');

// 创建日志目录
const logDir = path.join(process.cwd(), 'logs');

// 配置日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss,SSS'
  }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} - ${level.toUpperCase()} - ${message}`;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    // 文件输出
    new winston.transports.File({
      filename: path.join(logDir, 'DNSIPtest-nodejs.log'),
      encoding: 'utf8',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    }),
    // 控制台输出
    new winston.transports.Console({
      format: logFormat
    })
  ]
});

// 添加带表情符号的日志方法
logger.infoWithEmoji = (message) => {
  logger.info(message);
};

// 重写error方法避免递归
const originalError = logger.error;
logger.error = (message) => {
  if (typeof message === 'string' && message.startsWith('❌')) {
    originalError.call(logger, message);
  } else {
    originalError.call(logger, `❌ ${message}`);
  }
};

// 重写success方法
const originalInfo = logger.info;
logger.success = (message) => {
  originalInfo.call(logger, `✅ ${message}`);
};

// 重写warning方法
const originalWarn = logger.warn;
logger.warning = (message) => {
  originalWarn.call(logger, `⚠️ ${message}`);
};

module.exports = logger;