"use strict";
/**
 * Sistema de Logging Profissional com Winston
 * Substitui console.log por logging estruturado com níveis e rotação
 */
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
exports.httpLogger = httpLogger;
var winston_1 = require("winston");
// Definir níveis customizados
var levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Cores para cada nível
var colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'cyan',
};
winston_1.default.addColors(colors);
// Formato para console (desenvolvimento)
var consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(function (info) {
    var timestamp = info.timestamp, level = info.level, message = info.message, meta = __rest(info, ["timestamp", "level", "message"]);
    var metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return "".concat(timestamp, " [").concat(level, "]: ").concat(message, " ").concat(metaStr);
}));
// Formato para arquivo (produção)
var fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// Transportes (onde os logs vão)
var transports = [
    // Console sempre ativo
    new winston_1.default.transports.Console({
        format: consoleFormat,
    }),
];
// Em produção, adicionar arquivos de log
if (process.env.NODE_ENV === 'production') {
    transports.push(
    // Logs gerais
    new winston_1.default.transports.File({
        filename: 'logs/app.log',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }), 
    // Apenas erros
    new winston_1.default.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: fileFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }));
}
// Criar logger
var logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels: levels,
    transports: transports,
    exitOnError: false,
});
// Helper functions para facilitar uso
exports.log = {
    error: function (message, meta) { return logger.error(message, meta); },
    warn: function (message, meta) { return logger.warn(message, meta); },
    info: function (message, meta) { return logger.info(message, meta); },
    http: function (message, meta) { return logger.http(message, meta); },
    debug: function (message, meta) { return logger.debug(message, meta); },
};
// Middleware para logar requisições HTTP
function httpLogger(req, res, next) {
    var start = Date.now();
    res.on('finish', function () {
        var duration = Date.now() - start;
        var logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: "".concat(duration, "ms"),
            ip: req.ip,
            userAgent: req.get('user-agent'),
        };
        if (res.statusCode >= 500) {
            exports.log.error('HTTP Request', logData);
        }
        else if (res.statusCode >= 400) {
            exports.log.warn('HTTP Request', logData);
        }
        else {
            exports.log.http('HTTP Request', logData);
        }
    });
    next();
}
exports.default = logger;
