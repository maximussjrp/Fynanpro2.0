/**
 * Asaas — Tipos e constantes compartilhadas (Fase A1).
 *
 * Fonte: https://docs.asaas.com/reference (v3)
 * Observação: mantemos tipos MÍNIMOS. Campos adicionais do payload são
 * preservados no JSON bruto em `AsaasWebhookEvent.payload`.
 */

export const ASAAS_BASE_URL_SANDBOX = 'https://sandbox.asaas.com/api/v3';
export const ASAAS_BASE_URL_PRODUCTION = 'https://api.asaas.com/v3';

export type AsaasBillingType =
  | 'BOLETO'
  | 'CREDIT_CARD'
  | 'PIX'
  | 'UNDEFINED';

export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS';

export type AsaasSubscriptionStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'INACTIVE';

/**
 * Eventos de webhook que o UTOP reconhece. Outros eventos são aceitos
 * e persistidos como `received` sem erro, mas ignorados no roteamento.
 */
export const ASAAS_KNOWN_WEBHOOK_EVENTS = [
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
  'PAYMENT_DUNNING_RECEIVED',
  'PAYMENT_DUNNING_REQUESTED',
  'PAYMENT_BANK_SLIP_VIEWED',
  'PAYMENT_CHECKOUT_VIEWED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_DELETED',
] as const;

export type AsaasKnownEventType = (typeof ASAAS_KNOWN_WEBHOOK_EVENTS)[number];

/**
 * Payload mínimo de webhook. O Asaas envia sempre `event` e uma entidade
 * associada (payment, subscription, etc). Tratamos tudo além disso como opcional.
 */
export interface AsaasWebhookPayload {
  event: string;
  /** Alguns eventos do Asaas incluem um id único no topo; nem sempre presente. */
  id?: string;
  dateCreated?: string;
  payment?: AsaasPaymentObject;
  subscription?: AsaasSubscriptionObject;
  [key: string]: unknown;
}

export interface AsaasPaymentObject {
  id: string;
  customer: string;
  subscription?: string;
  value: number;
  netValue?: number;
  billingType: AsaasBillingType;
  status: AsaasPaymentStatus;
  dueDate: string;
  paymentDate?: string;
  invoiceUrl?: string;
  externalReference?: string;
  [key: string]: unknown;
}

export interface AsaasSubscriptionObject {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  status: AsaasSubscriptionStatus;
  billingType: AsaasBillingType;
  externalReference?: string;
  [key: string]: unknown;
}

export interface AsaasCustomerCreate {
  name: string;
  email?: string;
  cpfCnpj?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
  dateCreated?: string;
  [key: string]: unknown;
}

/**
 * Payload para POST /subscriptions.
 * Campos obrigatórios conforme docs v3: customer, billingType, value, nextDueDate, cycle.
 * externalReference é nosso "handle" (ex.: Subscription.id local) para reconciliação.
 */
export interface AsaasSubscriptionCreate {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
  endDate?: string;
  maxPayments?: number;
}

export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  status: AsaasSubscriptionStatus;
  billingType: AsaasBillingType;
  description?: string;
  externalReference?: string;
  dateCreated?: string;
  [key: string]: unknown;
}
