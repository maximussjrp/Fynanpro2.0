/**
 * Prisma Client Singleton
 */
import { PrismaClient } from '@prisma/client';
declare const prismaClientSingleton: () => PrismaClient<{
    log: ({
        emit: "event";
        level: "query";
    } | {
        emit: "event";
        level: "error";
    } | {
        emit: "event";
        level: "warn";
    })[];
}, "error" | "query" | "warn", import("@prisma/client/runtime/library").DefaultArgs>;
declare global {
    var prisma: ReturnType<typeof prismaClientSingleton> | undefined;
}
export declare const prisma: PrismaClient<{
    log: ({
        emit: "event";
        level: "query";
    } | {
        emit: "event";
        level: "error";
    } | {
        emit: "event";
        level: "warn";
    })[];
}, "error" | "query" | "warn", import("@prisma/client/runtime/library").DefaultArgs>;
export default prisma;
//# sourceMappingURL=prisma-client.d.ts.map