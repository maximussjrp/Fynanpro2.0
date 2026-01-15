/**
 * Swagger/OpenAPI Configuration
 * Documentação automática da API
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'UTOP API',
      version: '2.0.0',
      description: 'API completa para gestão financeira pessoal e empresarial com suporte multi-tenant',
      contact: {
        name: 'UTOP Support',
        email: 'support@utop.app',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Servidor de Desenvolvimento',
      },
      {
        url: 'https://api.utop.app/api/v1',
        description: 'Servidor de Produção',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtido via login ou registro',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Dados inválidos',
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: 'c1a5e8d0-1234-5678-9abc-def012345678',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'usuario@example.com',
            },
            fullName: {
              type: 'string',
              example: 'João da Silva',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
        },
        Tenant: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            slug: {
              type: 'string',
              example: 'minha-empresa',
            },
            name: {
              type: 'string',
              example: 'Minha Empresa',
            },
            plan: {
              type: 'string',
              enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'],
              example: 'FREE',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                user: {
                  $ref: '#/components/schemas/User',
                },
                tenant: {
                  $ref: '#/components/schemas/Tenant',
                },
              },
            },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            description: {
              type: 'string',
              example: 'Compra no supermercado',
            },
            amount: {
              type: 'number',
              format: 'double',
              example: 150.50,
            },
            type: {
              type: 'string',
              enum: ['INCOME', 'EXPENSE'],
              example: 'EXPENSE',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'CANCELLED'],
              example: 'PAID',
            },
            date: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
            categoryId: {
              type: 'string',
              format: 'uuid',
            },
            bankAccountId: {
              type: 'string',
              format: 'uuid',
            },
            paymentMethodId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            notes: {
              type: 'string',
              nullable: true,
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['alimentação', 'mensal'],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Endpoints de autenticação e gestão de tokens',
      },
      {
        name: 'Transactions',
        description: 'CRUD de transações financeiras',
      },
      {
        name: 'Dashboard',
        description: 'Dados agregados e métricas do dashboard',
      },
      {
        name: 'Bank Accounts',
        description: 'Gestão de contas bancárias',
      },
      {
        name: 'Categories',
        description: 'Categorias de receitas e despesas',
      },
      {
        name: 'Reports',
        description: 'Relatórios e análises financeiras',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/dtos/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
