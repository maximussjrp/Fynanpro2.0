"use strict";
/**
 * Payment Service - Integração com Asaas
 * Sistema de cobrança recorrente para assinaturas SaaS
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
exports.paymentService = exports.PLANS = void 0;
var client_1 = require("@prisma/client");
var logger_1 = require("../utils/logger");
var prisma = new client_1.PrismaClient();
// Configuração Asaas
var ASAAS_API_URL = process.env.ASAAS_SANDBOX === 'true'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
var ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
// Planos disponíveis
exports.PLANS = {
    trial: {
        id: 'trial',
        name: 'Trial',
        price: 0,
        priceYearly: 0,
        features: [
            '14 dias grátis',
            'Todas funcionalidades do Básico',
            'Sem cartão de crédito',
        ],
        limits: {
            users: 1,
            bankAccounts: 3,
            hasAdvancedReports: false,
            hasBudget: false,
            hasImport: false,
        }
    },
    basic: {
        id: 'basic',
        name: 'Básico',
        price: 9.90,
        priceYearly: 99.00,
        features: [
            '1 usuário',
            'Até 3 contas bancárias',
            'Transações ilimitadas',
            'Categorias hierárquicas',
            'Contas fixas recorrentes',
            'Dashboard básico',
        ],
        limits: {
            users: 1,
            bankAccounts: 3,
            hasAdvancedReports: false,
            hasBudget: false,
            hasImport: false,
        }
    },
    plus: {
        id: 'plus',
        name: 'Plus',
        price: 19.90,
        priceYearly: 199.00,
        features: [
            'Até 2 usuários',
            'Contas bancárias ilimitadas',
            'Orçamento mensal',
            'Projeção de fluxo de caixa',
            'Relatórios avançados',
            'Importação de extrato',
        ],
        limits: {
            users: 2,
            bankAccounts: -1, // ilimitado
            hasAdvancedReports: true,
            hasBudget: true,
            hasImport: true,
            importLimit: 100,
        }
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        price: 34.90,
        priceYearly: 349.00,
        features: [
            'Até 5 usuários',
            'Tudo do Plus',
            'Controle de gastos gatilho',
            'Projeção anual',
            'IA para categorização',
            'Suporte prioritário',
        ],
        limits: {
            users: 5,
            bankAccounts: -1,
            hasAdvancedReports: true,
            hasBudget: true,
            hasImport: true,
            importLimit: -1, // ilimitado
            hasTriggerControl: true,
            hasAI: true,
        }
    },
    business: {
        id: 'business',
        name: 'Business',
        price: 99.00,
        priceYearly: 990.00,
        features: [
            'Usuários ilimitados',
            'Multi-tenant',
            'White-label',
            'API de integração',
            'Suporte dedicado',
            'SLA 99.9%',
        ],
        limits: {
            users: -1, // ilimitado
            bankAccounts: -1,
            hasAdvancedReports: true,
            hasBudget: true,
            hasImport: true,
            importLimit: -1,
            hasTriggerControl: true,
            hasAI: true,
            hasAPI: true,
            hasWhiteLabel: true,
        }
    }
};
function asaasRequest(endpoint_1) {
    return __awaiter(this, arguments, void 0, function (endpoint, method, body) {
        var response, error;
        var _a, _b;
        if (method === void 0) { method = 'GET'; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, fetch("".concat(ASAAS_API_URL).concat(endpoint), {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json',
                            'access_token': ASAAS_API_KEY,
                        },
                        body: body ? JSON.stringify(body) : undefined,
                    })];
                case 1:
                    response = _c.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.json()];
                case 2:
                    error = _c.sent();
                    logger_1.log.error('Asaas API Error', { endpoint: endpoint, error: error });
                    throw new Error(((_b = (_a = error.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.description) || 'Erro na API Asaas');
                case 3: return [2 /*return*/, response.json()];
            }
        });
    });
}
exports.paymentService = {
    /**
     * Buscar ou criar cliente no Asaas
     */
    findOrCreateCustomer: function (tenantId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var tenant, subscription, customer_1, e_1, customer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.tenant.findUnique({
                            where: { id: tenantId },
                            include: { owner: true }
                        })];
                    case 1:
                        tenant = _a.sent();
                        if (!tenant)
                            throw new Error('Tenant não encontrado');
                        return [4 /*yield*/, prisma.subscription.findFirst({
                                where: { tenantId: tenantId }
                            })];
                    case 2:
                        subscription = _a.sent();
                        if (!(subscription === null || subscription === void 0 ? void 0 : subscription.asaasCustomerId)) return [3 /*break*/, 6];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, asaasRequest("/customers/".concat(subscription.asaasCustomerId))];
                    case 4:
                        customer_1 = _a.sent();
                        return [2 /*return*/, customer_1];
                    case 5:
                        e_1 = _a.sent();
                        // Cliente não existe mais, criar novo
                        logger_1.log.warn('Cliente Asaas não encontrado, criando novo', { error: e_1 });
                        return [3 /*break*/, 6];
                    case 6: return [4 /*yield*/, asaasRequest('/customers', 'POST', {
                            name: tenant.owner.fullName,
                            email: tenant.owner.email,
                            externalReference: tenantId,
                        })];
                    case 7:
                        customer = _a.sent();
                        return [2 /*return*/, customer];
                }
            });
        });
    },
    /**
     * Criar checkout para assinatura
     */
    createCheckout: function (tenantId_1, userId_1, planId_1, billingCycle_1) {
        return __awaiter(this, arguments, void 0, function (tenantId, userId, planId, billingCycle, billingType) {
            var plan, customer, value, cycle, subscription, payments, firstPayment;
            var _a;
            if (billingType === void 0) { billingType = 'CREDIT_CARD'; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        plan = exports.PLANS[planId];
                        if (!plan)
                            throw new Error('Plano não encontrado');
                        return [4 /*yield*/, this.findOrCreateCustomer(tenantId, userId)];
                    case 1:
                        customer = _b.sent();
                        value = billingCycle === 'yearly' ? plan.priceYearly : plan.price;
                        cycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
                        return [4 /*yield*/, asaasRequest('/subscriptions', 'POST', {
                                customer: customer.id,
                                billingType: billingType,
                                cycle: cycle,
                                value: value,
                                description: "UTOP - Plano ".concat(plan.name),
                                externalReference: "".concat(tenantId, ":").concat(planId),
                            })];
                    case 2:
                        subscription = _b.sent();
                        // Salvar assinatura no banco
                        return [4 /*yield*/, prisma.subscription.upsert({
                                where: { tenantId: tenantId },
                                create: {
                                    tenantId: tenantId,
                                    planId: planId,
                                    billingCycle: billingCycle,
                                    status: 'pending',
                                    asaasCustomerId: customer.id,
                                    asaasSubscriptionId: subscription.id,
                                    currentPeriodStart: new Date(),
                                    currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
                                },
                                update: {
                                    planId: planId,
                                    billingCycle: billingCycle,
                                    status: 'pending',
                                    asaasCustomerId: customer.id,
                                    asaasSubscriptionId: subscription.id,
                                    currentPeriodStart: new Date(),
                                    currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
                                }
                            })];
                    case 3:
                        // Salvar assinatura no banco
                        _b.sent();
                        return [4 /*yield*/, asaasRequest("/subscriptions/".concat(subscription.id, "/payments"))];
                    case 4:
                        payments = _b.sent();
                        firstPayment = (_a = payments.data) === null || _a === void 0 ? void 0 : _a[0];
                        return [2 /*return*/, {
                                subscriptionId: subscription.id,
                                paymentId: firstPayment === null || firstPayment === void 0 ? void 0 : firstPayment.id,
                                invoiceUrl: firstPayment === null || firstPayment === void 0 ? void 0 : firstPayment.invoiceUrl,
                                bankSlipUrl: firstPayment === null || firstPayment === void 0 ? void 0 : firstPayment.bankSlipUrl,
                                pixQrCodeUrl: firstPayment === null || firstPayment === void 0 ? void 0 : firstPayment.pixQrCodeUrl,
                                pixCopiaECola: firstPayment === null || firstPayment === void 0 ? void 0 : firstPayment.pixCopiaECola,
                                value: value,
                                dueDate: firstPayment === null || firstPayment === void 0 ? void 0 : firstPayment.dueDate,
                            }];
                }
            });
        });
    },
    /**
     * Criar checkout com cartão de crédito (tokenizado)
     */
    createCreditCardCheckout: function (tenantId, userId, planId, billingCycle, creditCard, creditCardHolderInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var plan, customer, value, cycle, subscription;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        plan = exports.PLANS[planId];
                        if (!plan)
                            throw new Error('Plano não encontrado');
                        return [4 /*yield*/, this.findOrCreateCustomer(tenantId, userId)];
                    case 1:
                        customer = _a.sent();
                        value = billingCycle === 'yearly' ? plan.priceYearly : plan.price;
                        cycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
                        return [4 /*yield*/, asaasRequest('/subscriptions', 'POST', {
                                customer: customer.id,
                                billingType: 'CREDIT_CARD',
                                cycle: cycle,
                                value: value,
                                description: "UTOP - Plano ".concat(plan.name),
                                externalReference: "".concat(tenantId, ":").concat(planId),
                                creditCard: {
                                    holderName: creditCard.holderName,
                                    number: creditCard.number,
                                    expiryMonth: creditCard.expiryMonth,
                                    expiryYear: creditCard.expiryYear,
                                    ccv: creditCard.ccv,
                                },
                                creditCardHolderInfo: creditCardHolderInfo,
                            })];
                    case 2:
                        subscription = _a.sent();
                        // Salvar assinatura no banco
                        return [4 /*yield*/, prisma.subscription.upsert({
                                where: { tenantId: tenantId },
                                create: {
                                    tenantId: tenantId,
                                    planId: planId,
                                    billingCycle: billingCycle,
                                    status: subscription.status === 'ACTIVE' ? 'active' : 'pending',
                                    asaasCustomerId: customer.id,
                                    asaasSubscriptionId: subscription.id,
                                    currentPeriodStart: new Date(),
                                    currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
                                },
                                update: {
                                    planId: planId,
                                    billingCycle: billingCycle,
                                    status: subscription.status === 'ACTIVE' ? 'active' : 'pending',
                                    asaasCustomerId: customer.id,
                                    asaasSubscriptionId: subscription.id,
                                    currentPeriodStart: new Date(),
                                    currentPeriodEnd: this.calculatePeriodEnd(billingCycle),
                                }
                            })];
                    case 3:
                        // Salvar assinatura no banco
                        _a.sent();
                        if (!(subscription.status === 'ACTIVE')) return [3 /*break*/, 5];
                        return [4 /*yield*/, prisma.tenant.update({
                                where: { id: tenantId },
                                data: {
                                    subscriptionPlan: planId,
                                    subscriptionStatus: 'active',
                                }
                            })];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/, {
                            subscriptionId: subscription.id,
                            status: subscription.status,
                            success: subscription.status === 'ACTIVE',
                        }];
                }
            });
        });
    },
    /**
     * Processar webhook do Asaas
     */
    handleWebhook: function (event, payment) {
        return __awaiter(this, void 0, void 0, function () {
            var existingPayment, subscription, statusMap, status;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.log.info('Webhook Asaas recebido', { event: event, paymentId: payment.id });
                        return [4 /*yield*/, prisma.payment.findFirst({
                                where: { asaasPaymentId: payment.id }
                            })];
                    case 1:
                        existingPayment = _a.sent();
                        return [4 /*yield*/, prisma.subscription.findFirst({
                                where: { asaasCustomerId: payment.customer }
                            })];
                    case 2:
                        subscription = _a.sent();
                        if (!subscription) {
                            logger_1.log.warn('Subscription não encontrada para pagamento', { paymentId: payment.id });
                            return [2 /*return*/];
                        }
                        statusMap = {
                            'PENDING': 'pending',
                            'RECEIVED': 'paid',
                            'CONFIRMED': 'paid',
                            'OVERDUE': 'overdue',
                            'REFUNDED': 'refunded',
                            'CANCELLED': 'cancelled',
                        };
                        status = statusMap[payment.status] || 'pending';
                        // Upsert do pagamento
                        return [4 /*yield*/, prisma.payment.upsert({
                                where: { id: (existingPayment === null || existingPayment === void 0 ? void 0 : existingPayment.id) || 'new' },
                                create: {
                                    tenantId: subscription.tenantId,
                                    subscriptionId: subscription.id,
                                    asaasPaymentId: payment.id,
                                    amount: payment.value,
                                    status: status,
                                    billingType: payment.billingType,
                                    dueDate: new Date(payment.dueDate),
                                    paidAt: status === 'paid' ? new Date() : null,
                                    invoiceUrl: payment.invoiceUrl,
                                    boletoUrl: payment.bankSlipUrl,
                                    pixQrCodeUrl: payment.pixQrCodeUrl,
                                    pixCopiaECola: payment.pixCopiaECola,
                                },
                                update: {
                                    status: status,
                                    paidAt: status === 'paid' ? new Date() : existingPayment === null || existingPayment === void 0 ? void 0 : existingPayment.paidAt,
                                }
                            })];
                    case 3:
                        // Upsert do pagamento
                        _a.sent();
                        if (!(event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED')) return [3 /*break*/, 6];
                        // Pagamento confirmado - ativar assinatura
                        return [4 /*yield*/, prisma.subscription.update({
                                where: { id: subscription.id },
                                data: {
                                    status: 'active',
                                    currentPeriodStart: new Date(),
                                    currentPeriodEnd: this.calculatePeriodEnd(subscription.billingCycle),
                                }
                            })];
                    case 4:
                        // Pagamento confirmado - ativar assinatura
                        _a.sent();
                        return [4 /*yield*/, prisma.tenant.update({
                                where: { id: subscription.tenantId },
                                data: {
                                    subscriptionPlan: subscription.planId,
                                    subscriptionStatus: 'active',
                                }
                            })];
                    case 5:
                        _a.sent();
                        logger_1.log.info('Assinatura ativada', { tenantId: subscription.tenantId, planId: subscription.planId });
                        _a.label = 6;
                    case 6:
                        if (!(event === 'PAYMENT_OVERDUE')) return [3 /*break*/, 9];
                        // Pagamento atrasado
                        return [4 /*yield*/, prisma.subscription.update({
                                where: { id: subscription.id },
                                data: { status: 'overdue' }
                            })];
                    case 7:
                        // Pagamento atrasado
                        _a.sent();
                        return [4 /*yield*/, prisma.tenant.update({
                                where: { id: subscription.tenantId },
                                data: { subscriptionStatus: 'suspended' }
                            })];
                    case 8:
                        _a.sent();
                        logger_1.log.warn('Assinatura suspensa por atraso', { tenantId: subscription.tenantId });
                        _a.label = 9;
                    case 9:
                        if (!(event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED')) return [3 /*break*/, 12];
                        // Pagamento cancelado/estornado
                        return [4 /*yield*/, prisma.subscription.update({
                                where: { id: subscription.id },
                                data: { status: 'cancelled' }
                            })];
                    case 10:
                        // Pagamento cancelado/estornado
                        _a.sent();
                        return [4 /*yield*/, prisma.tenant.update({
                                where: { id: subscription.tenantId },
                                data: {
                                    subscriptionPlan: 'basic',
                                    subscriptionStatus: 'active',
                                }
                            })];
                    case 11:
                        _a.sent();
                        logger_1.log.info('Assinatura cancelada, downgrade para básico', { tenantId: subscription.tenantId });
                        _a.label = 12;
                    case 12: return [2 /*return*/];
                }
            });
        });
    },
    /**
     * Cancelar assinatura
     */
    cancelSubscription: function (tenantId, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.subscription.findFirst({
                            where: { tenantId: tenantId, status: { in: ['active', 'pending', 'overdue'] } }
                        })];
                    case 1:
                        subscription = _a.sent();
                        if (!subscription || !subscription.asaasSubscriptionId) {
                            throw new Error('Assinatura não encontrada');
                        }
                        // Cancelar no Asaas
                        return [4 /*yield*/, asaasRequest("/subscriptions/".concat(subscription.asaasSubscriptionId), 'DELETE')];
                    case 2:
                        // Cancelar no Asaas
                        _a.sent();
                        // Atualizar banco
                        return [4 /*yield*/, prisma.subscription.update({
                                where: { id: subscription.id },
                                data: {
                                    status: 'cancelled',
                                    cancelledAt: new Date(),
                                    cancellationReason: reason,
                                }
                            })];
                    case 3:
                        // Atualizar banco
                        _a.sent();
                        // Downgrade para básico no final do período
                        // (mantém acesso até o final do período pago)
                        logger_1.log.info('Assinatura cancelada', { tenantId: tenantId, reason: reason });
                        return [2 /*return*/, { success: true, message: 'Assinatura cancelada com sucesso' }];
                }
            });
        });
    },
    /**
     * Obter assinatura atual do tenant
     */
    getSubscription: function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription, tenant;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.subscription.findFirst({
                            where: { tenantId: tenantId },
                            orderBy: { createdAt: 'desc' },
                            include: {
                                payments: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 10,
                                }
                            }
                        })];
                    case 1:
                        subscription = _a.sent();
                        return [4 /*yield*/, prisma.tenant.findUnique({
                                where: { id: tenantId }
                            })];
                    case 2:
                        tenant = _a.sent();
                        return [2 /*return*/, {
                                subscription: subscription,
                                currentPlan: (tenant === null || tenant === void 0 ? void 0 : tenant.subscriptionPlan) || 'trial',
                                status: (tenant === null || tenant === void 0 ? void 0 : tenant.subscriptionStatus) || 'active',
                                plans: exports.PLANS,
                            }];
                }
            });
        });
    },
    /**
     * Calcular fim do período
     */
    calculatePeriodEnd: function (cycle) {
        var now = new Date();
        if (cycle === 'yearly') {
            return new Date(now.setFullYear(now.getFullYear() + 1));
        }
        return new Date(now.setMonth(now.getMonth() + 1));
    },
    /**
     * Verificar se o trial expirou
     */
    checkTrialExpiration: function (tenantId) {
        return __awaiter(this, void 0, void 0, function () {
            var tenant;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.tenant.findUnique({
                            where: { id: tenantId }
                        })];
                    case 1:
                        tenant = _a.sent();
                        if (!tenant || tenant.subscriptionPlan !== 'trial') {
                            return [2 /*return*/, false];
                        }
                        if (!(tenant.trialEndsAt && new Date() > tenant.trialEndsAt)) return [3 /*break*/, 3];
                        // Trial expirou - fazer downgrade para básico com limitações
                        return [4 /*yield*/, prisma.tenant.update({
                                where: { id: tenantId },
                                data: {
                                    subscriptionPlan: 'basic',
                                    subscriptionStatus: 'active',
                                }
                            })];
                    case 2:
                        // Trial expirou - fazer downgrade para básico com limitações
                        _a.sent();
                        return [2 /*return*/, true];
                    case 3: return [2 /*return*/, false];
                }
            });
        });
    },
    /**
     * Listar todos os planos
     */
    getPlans: function () {
        return Object.values(exports.PLANS);
    }
};
