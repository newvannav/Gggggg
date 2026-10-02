"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERMINAL_STATUSES = void 0;
exports.canTransition = canTransition;
exports.assertTransition = assertTransition;
exports.isTerminal = isTerminal;
const prisma_1 = require("../generated/prisma");
const TRANSITIONS = Object.freeze({
    [prisma_1.OrderStatus.PENDING]: new Set([
        prisma_1.OrderStatus.ACCEPTED_BY_SHOP,
        prisma_1.OrderStatus.CANCELLED,
    ]),
    [prisma_1.OrderStatus.ACCEPTED_BY_SHOP]: new Set([
        prisma_1.OrderStatus.PREPARING,
        prisma_1.OrderStatus.CANCELLED,
    ]),
    [prisma_1.OrderStatus.PREPARING]: new Set([
        prisma_1.OrderStatus.AWAITING_PICKUP,
        prisma_1.OrderStatus.CANCELLED,
    ]),
    [prisma_1.OrderStatus.AWAITING_PICKUP]: new Set([
        prisma_1.OrderStatus.OUT_FOR_DELIVERY,
        prisma_1.OrderStatus.CANCELLED,
    ]),
    [prisma_1.OrderStatus.OUT_FOR_DELIVERY]: new Set([
        prisma_1.OrderStatus.DELIVERED,
        prisma_1.OrderStatus.CANCELLED,
    ]),
    [prisma_1.OrderStatus.DELIVERED]: new Set([]),
    [prisma_1.OrderStatus.CANCELLED]: new Set([]),
});
function canTransition(from, to) {
    return TRANSITIONS[from]?.has(to) ?? false;
}
function assertTransition(from, to) {
    if (!canTransition(from, to)) {
        throw new Error(`Illegal order status transition: ${from} -> ${to}`);
    }
}
exports.TERMINAL_STATUSES = new Set([
    prisma_1.OrderStatus.DELIVERED,
    prisma_1.OrderStatus.CANCELLED,
]);
function isTerminal(status) {
    return exports.TERMINAL_STATUSES.has(status);
}
//# sourceMappingURL=order-status.machine.js.map