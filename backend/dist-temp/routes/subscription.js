"use strict";
/**
 * Rotas de Pagamento e Assinatura
 * Gerenciamento de planos, checkout e webhooks
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var payment_service_1 = require("../services/payment.service");
var auth_1 = require("../middleware/auth");
var logger_1 = require("../utils/logger");
var router = (0, express_1.Router)();
/**
 * @swagger
 * /subscription/plans:
 *   get:
 *     summary: Listar planos disponíveis
 *     tags: [Subscription]
 *     responses:
 *       200:
 *         description: Lista de planos
 */
router.get('/plans', function (req, res) {
    try {
        var plans = payment_service_1.paymentService.getPlans();
        res.json({
            success: true,
            data: plans
        });
    }
    catch (error) {
        logger_1.log.error('Erro ao listar planos', { error: error });
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar planos' }
        });
    }
});
/**
 * @swagger
 * /subscription/current:
 *   get:
 *     summary: Obter assinatura atual
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.get('/current', auth_1.authenticateToken, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, data, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                tenantId = req.tenantId;
                return [4 /*yield*/, payment_service_1.paymentService.getSubscription(tenantId)];
            case 1:
                data = _a.sent();
                res.json({
                    success: true,
                    data: data
                });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                logger_1.log.error('Erro ao obter assinatura', { error: error_1, tenantId: req.tenantId });
                res.status(500).json({
                    success: false,
                    error: { code: 'INTERNAL_ERROR', message: 'Erro ao obter assinatura' }
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @swagger
 * /subscription/checkout:
 *   post:
 *     summary: Criar checkout para assinatura
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - billingCycle
 *             properties:
 *               planId:
 *                 type: string
 *                 enum: [basic, plus, premium, business]
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               billingType:
 *                 type: string
 *                 enum: [CREDIT_CARD, BOLETO, PIX]
 */
router.post('/checkout', auth_1.authenticateToken, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, _a, planId, billingCycle, _b, billingType, checkout, error_2;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                tenantId = req.tenantId;
                userId = req.userId;
                _a = req.body, planId = _a.planId, billingCycle = _a.billingCycle, _b = _a.billingType, billingType = _b === void 0 ? 'PIX' : _b;
                if (!planId || !billingCycle) {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            error: { code: 'VALIDATION_ERROR', message: 'planId e billingCycle são obrigatórios' }
                        })];
                }
                if (!payment_service_1.PLANS[planId]) {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            error: { code: 'INVALID_PLAN', message: 'Plano inválido' }
                        })];
                }
                return [4 /*yield*/, payment_service_1.paymentService.createCheckout(tenantId, userId, planId, billingCycle, billingType)];
            case 1:
                checkout = _c.sent();
                res.json({
                    success: true,
                    data: checkout
                });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _c.sent();
                logger_1.log.error('Erro ao criar checkout', { error: error_2, tenantId: req.tenantId });
                res.status(500).json({
                    success: false,
                    error: { code: 'CHECKOUT_ERROR', message: error_2.message || 'Erro ao criar checkout' }
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @swagger
 * /subscription/checkout/credit-card:
 *   post:
 *     summary: Checkout com cartão de crédito
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.post('/checkout/credit-card', auth_1.authenticateToken, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, _a, planId, billingCycle, creditCard, creditCardHolderInfo, result, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                tenantId = req.tenantId;
                userId = req.userId;
                _a = req.body, planId = _a.planId, billingCycle = _a.billingCycle, creditCard = _a.creditCard, creditCardHolderInfo = _a.creditCardHolderInfo;
                if (!planId || !billingCycle || !creditCard || !creditCardHolderInfo) {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            error: { code: 'VALIDATION_ERROR', message: 'Dados incompletos' }
                        })];
                }
                return [4 /*yield*/, payment_service_1.paymentService.createCreditCardCheckout(tenantId, userId, planId, billingCycle, creditCard, creditCardHolderInfo)];
            case 1:
                result = _b.sent();
                res.json({
                    success: true,
                    data: result
                });
                return [3 /*break*/, 3];
            case 2:
                error_3 = _b.sent();
                logger_1.log.error('Erro no checkout com cartão', { error: error_3, tenantId: req.tenantId });
                res.status(500).json({
                    success: false,
                    error: { code: 'PAYMENT_ERROR', message: error_3.message || 'Erro no pagamento' }
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @swagger
 * /subscription/cancel:
 *   post:
 *     summary: Cancelar assinatura
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.post('/cancel', auth_1.authenticateToken, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, reason, result, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                tenantId = req.tenantId;
                reason = req.body.reason;
                return [4 /*yield*/, payment_service_1.paymentService.cancelSubscription(tenantId, reason)];
            case 1:
                result = _a.sent();
                res.json({
                    success: true,
                    data: result
                });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _a.sent();
                logger_1.log.error('Erro ao cancelar assinatura', { error: error_4, tenantId: req.tenantId });
                res.status(500).json({
                    success: false,
                    error: { code: 'CANCEL_ERROR', message: error_4.message || 'Erro ao cancelar' }
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * @swagger
 * /subscription/webhook:
 *   post:
 *     summary: Webhook do Asaas
 *     tags: [Subscription]
 *     description: Endpoint para receber notificações do Asaas
 */
router.post('/webhook', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, event_1, payment, webhookToken, expectedToken, error_5;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                _a = req.body, event_1 = _a.event, payment = _a.payment;
                webhookToken = req.headers['asaas-access-token'];
                expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
                if (expectedToken && webhookToken !== expectedToken) {
                    logger_1.log.warn('Webhook com token inválido', { event: event_1 });
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                }
                logger_1.log.info('Webhook recebido', { event: event_1, paymentId: payment === null || payment === void 0 ? void 0 : payment.id });
                if (!payment) return [3 /*break*/, 2];
                return [4 /*yield*/, payment_service_1.paymentService.handleWebhook(event_1, payment)];
            case 1:
                _b.sent();
                _b.label = 2;
            case 2:
                // Asaas espera 200 OK
                res.status(200).json({ received: true });
                return [3 /*break*/, 4];
            case 3:
                error_5 = _b.sent();
                logger_1.log.error('Erro ao processar webhook', { error: error_5 });
                // Retornar 200 mesmo com erro para não reprocessar
                res.status(200).json({ received: true, error: 'Processing error' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
/**
 * @swagger
 * /subscription/check-trial:
 *   get:
 *     summary: Verificar se trial expirou
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 */
router.get('/check-trial', auth_1.authenticateToken, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, expired, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                tenantId = req.tenantId;
                return [4 /*yield*/, payment_service_1.paymentService.checkTrialExpiration(tenantId)];
            case 1:
                expired = _a.sent();
                res.json({
                    success: true,
                    data: { trialExpired: expired }
                });
                return [3 /*break*/, 3];
            case 2:
                error_6 = _a.sent();
                logger_1.log.error('Erro ao verificar trial', { error: error_6, tenantId: req.tenantId });
                res.status(500).json({
                    success: false,
                    error: { code: 'INTERNAL_ERROR', message: 'Erro ao verificar trial' }
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
