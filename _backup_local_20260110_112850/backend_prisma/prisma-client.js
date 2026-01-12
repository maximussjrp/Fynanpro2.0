"use strict";
/**
 * Prisma Client Singleton
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../src/utils/logger");
const prismaClientSingleton = () => {
    return new client_1.PrismaClient({
        log: [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
        ],
    });
};
exports.prisma = globalThis.prisma ?? prismaClientSingleton();
// Logging de queries em desenvolvimento
if (process.env.NODE_ENV === 'development') {
    // @ts-ignore
    exports.prisma.$on('query', (e) => {
        if (e.duration > 100) {
            // Apenas queries lentas (> 100ms)
            logger_1.log.warn('Slow query detected', { query: e.query, duration: `${e.duration}ms` });
        }
    });
}
// @ts-ignore
exports.prisma.$on('error', (e) => {
    logger_1.log.error('Prisma error', { error: e });
});
// @ts-ignore
exports.prisma.$on('warn', (e) => {
    logger_1.log.warn('Prisma warning', { warning: e });
});
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = exports.prisma;
}
exports.default = exports.prisma;
//# sourceMappingURL=prisma-client.js.map