import type { Request } from "express";
import { paymentMethodsRepository } from "./payment-methods.repository";
import type {
  PaymentMethodCode,
  PaymentMethodDefinitionDto,
  PaymentMethodTenantUsageDto,
  TenantPaymentMethodDto,
} from "./payment-methods.types";
import { AppError, createValidationError } from "../../utils/errors";
import { writePaymentMethodAuditLog } from "../../utils/audit-log";

type GlobalUpdateInput = {
  name_ar: string;
  name_en: string;
  category: string;
  is_globally_enabled: boolean;
  supports_manual_review: boolean;
  sort_order: number;
};

type TenantUpdateInput = {
  is_active: boolean;
  account_number: string;
  account_name: string;
  instructions_ar: string;
  instructions_en: string;
  metadata: Record<string, unknown>;
};

export class PaymentMethodsService {
  async initializeTenantPaymentMethods(tenantId: number) {
    const tenant = await paymentMethodsRepository.getTenantById(tenantId);
    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }
    const definitions = await paymentMethodsRepository.listDefinitions();
    const codes = definitions.map((item) => item.code as PaymentMethodCode);
    await paymentMethodsRepository.insertMissingTenantMethodRows(tenantId, codes);
  }

  async listAdminPaymentMethods(): Promise<PaymentMethodDefinitionDto[]> {
    const definitions = await paymentMethodsRepository.listDefinitions();
    const tenantMethods = await Promise.all(
      definitions.map((definition) => paymentMethodsRepository.listMethodTenants(definition.code as PaymentMethodCode)),
    );

    return definitions
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((definition, index) => ({
        id: definition.id,
        code: definition.code as PaymentMethodCode,
        name_ar: definition.nameAr,
        name_en: definition.nameEn,
        category: definition.category,
        is_globally_enabled: definition.isGloballyEnabled,
        supports_manual_review: definition.supportsManualReview,
        sort_order: definition.sortOrder,
        tenants_count: (tenantMethods[index] ?? []).filter((item) => item.isActive).length,
        updated_at: definition.updatedAt.toISOString(),
      }));
  }

  async listPaymentMethodTenants(code: PaymentMethodCode): Promise<PaymentMethodTenantUsageDto[]> {
    const tenants = await paymentMethodsRepository.listMethodTenants(code);
    return tenants.map((item) => ({
      tenant_id: item.tenantId,
      tenant_name: item.tenantName,
      is_active: item.isActive,
      updated_at: item.updatedAt.toISOString(),
    }));
  }

  async updateGlobalDefinition(req: Request, code: PaymentMethodCode, payload: GlobalUpdateInput) {
    const existing = await paymentMethodsRepository.getDefinitionByCode(code);
    const updated = await paymentMethodsRepository.upsertDefinition(code, {
      code,
      nameAr: payload.name_ar,
      nameEn: payload.name_en,
      category: payload.category,
      isGloballyEnabled: payload.is_globally_enabled,
      supportsManualReview: payload.supports_manual_review,
      sortOrder: payload.sort_order,
    });

    await writePaymentMethodAuditLog({
      req,
      paymentMethodCode: code,
      action: !existing
        ? "GLOBAL_METHOD_UPDATED"
        : payload.is_globally_enabled
          ? existing.isGloballyEnabled ? "GLOBAL_METHOD_UPDATED" : "GLOBAL_METHOD_ENABLED"
          : "GLOBAL_METHOD_DISABLED",
      oldValues: existing ? {
        code: existing.code,
        name_ar: existing.nameAr,
        name_en: existing.nameEn,
        is_globally_enabled: existing.isGloballyEnabled,
        category: existing.category,
        sort_order: existing.sortOrder,
      } : null,
      newValues: {
        code: updated.code,
        name_ar: updated.nameAr,
        name_en: updated.nameEn,
        is_globally_enabled: updated.isGloballyEnabled,
        category: updated.category,
        sort_order: updated.sortOrder,
      },
    });

    return updated;
  }

  async listTenantPaymentMethods(tenantId: number): Promise<TenantPaymentMethodDto[]> {
    await this.initializeTenantPaymentMethods(tenantId);
    const [definitions, tenantRows, auditLogs] = await Promise.all([
      paymentMethodsRepository.listDefinitions(),
      paymentMethodsRepository.listTenantPaymentMethods(tenantId),
      paymentMethodsRepository.listPaymentMethodAuditLogs(tenantId),
    ]);
    const rowsByCode = new Map(tenantRows.map((row) => [row.paymentMethodCode, row]));
    const updatedByIds = [...new Set(
      tenantRows
        .map((row) => row.updatedBy)
        .filter((updatedBy): updatedBy is number => typeof updatedBy === "number" && updatedBy > 0),
    )];
    const users = await paymentMethodsRepository.listUsersByIds(updatedByIds);
    const userNamesById = new Map(users.map((user) => [user.id, user.fullName]));
    const latestAuditByCode = new Map<string, string | null>();

    for (const log of auditLogs) {
      if (latestAuditByCode.has(log.paymentMethodCode)) {
        continue;
      }
      latestAuditByCode.set(log.paymentMethodCode, log.actorName ?? null);
    }

    return definitions
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((definition) => {
        const row = rowsByCode.get(definition.code);
        const updatedByName = row
          ? userNamesById.get(row.updatedBy ?? 0) ?? latestAuditByCode.get(definition.code) ?? null
          : null;

        return {
          id: row?.id ?? 0,
          tenant_id: tenantId,
          code: definition.code as PaymentMethodCode,
          name_ar: definition.nameAr,
          name_en: definition.nameEn,
          is_globally_enabled: definition.isGloballyEnabled,
          is_active: row?.isActive ?? false,
          account_number: row?.accountNumber ?? "",
          account_name: row?.accountName ?? "",
          instructions_ar: row?.instructionsAr ?? "",
          instructions_en: row?.instructionsEn ?? "",
          metadata: (row?.metadata as Record<string, unknown> | null) ?? {},
          updated_at: (row?.updatedAt ?? definition.updatedAt).toISOString(),
          updated_by_name: updatedByName,
        };
      });
  }

  async listBillingVisiblePaymentMethods(tenantId: number) {
    const methods = await this.listTenantPaymentMethods(tenantId);
    return methods.filter((method) => method.is_globally_enabled && method.is_active);
  }

  validateTenantPayload(globalEnabled: boolean, payload: TenantUpdateInput) {
    const errors: Record<string, string[]> = {};

    if (payload.is_active && !globalEnabled) {
      errors.is_active = ["Payment method must be globally enabled first"];
    }

    if (payload.is_active && !payload.account_number.trim()) {
      errors.account_number = ["Account number is required"];
    }

    if (payload.is_active && !payload.account_name.trim()) {
      errors.account_name = ["Account name is required"];
    }

    if (Object.keys(errors).length > 0) {
      throw createValidationError(errors);
    }
  }

  async updateTenantPaymentMethod(req: Request, tenantId: number, code: PaymentMethodCode, payload: TenantUpdateInput) {
    const definition = await paymentMethodsRepository.getDefinitionByCode(code);
    if (!definition) {
      throw new AppError("Payment method not found", 404);
    }

    this.validateTenantPayload(definition.isGloballyEnabled, payload);

    await this.initializeTenantPaymentMethods(tenantId);
    const existing = await paymentMethodsRepository.getTenantPaymentMethod(tenantId, code);
    const updated = await paymentMethodsRepository.upsertTenantPaymentMethod(tenantId, code, {
      tenantId,
      paymentMethodCode: code,
      isActive: payload.is_active,
      accountNumber: payload.account_number || null,
      accountName: payload.account_name || null,
      instructionsAr: payload.instructions_ar || null,
      instructionsEn: payload.instructions_en || null,
      metadata: payload.metadata || {},
      updatedBy: req.user?.role === "admin" ? req.user.userId : null,
    });

    await writePaymentMethodAuditLog({
      req,
      paymentMethodCode: code,
      tenantId,
      action: !existing
        ? "TENANT_METHOD_UPDATED"
        : payload.is_active
          ? existing.isActive ? "TENANT_METHOD_UPDATED" : "TENANT_METHOD_ENABLED"
          : "TENANT_METHOD_DISABLED",
      oldValues: existing ? {
        is_active: existing.isActive,
        account_number: existing.accountNumber,
        account_name: existing.accountName,
        instructions_ar: existing.instructionsAr,
        instructions_en: existing.instructionsEn,
        metadata: existing.metadata,
      } : null,
      newValues: {
        is_active: updated.isActive,
        account_number: updated.accountNumber,
        account_name: updated.accountName,
        instructions_ar: updated.instructionsAr,
        instructions_en: updated.instructionsEn,
        metadata: updated.metadata,
      },
    });

    let updatedByName: string | null = null;
    if (updated.updatedBy) {
      const [user] = await paymentMethodsRepository.listUsersByIds([updated.updatedBy]);
      updatedByName = user?.fullName ?? null;
    }
    if (!updatedByName) {
      const latestAudit = await paymentMethodsRepository.getLatestTenantMethodAuditLog(tenantId, code);
      updatedByName = latestAudit?.actorName ?? null;
    }
    return {
      id: updated.id,
      tenant_id: tenantId,
      code,
      name_ar: definition.nameAr,
      name_en: definition.nameEn,
      is_globally_enabled: definition.isGloballyEnabled,
      is_active: updated.isActive,
      account_number: updated.accountNumber ?? "",
      account_name: updated.accountName ?? "",
      instructions_ar: updated.instructionsAr ?? "",
      instructions_en: updated.instructionsEn ?? "",
      metadata: (updated.metadata as Record<string, unknown> | null) ?? {},
      updated_at: updated.updatedAt.toISOString(),
      updated_by_name: updatedByName,
    } satisfies TenantPaymentMethodDto;
  }
}

export const paymentMethodsService = new PaymentMethodsService();
