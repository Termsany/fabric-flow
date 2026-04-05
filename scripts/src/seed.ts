import bcrypt from "bcryptjs";
import { sql, eq, and } from "drizzle-orm";
import {
  db,
  pool,
  tenantsTable,
  usersTable,
  customersTable,
  suppliersTable,
  warehousesTable,
  warehouseLocationsTable,
  productionOrdersTable,
  fabricRollsTable,
  qcReportsTable,
  dyeingOrdersTable,
  warehouseMovementsTable,
  salesOrdersTable,
  invoicesTable,
  auditLogsTable,
  billingEventsTable,
  platformAdminsTable,
  plansTable,
  planPricesTable,
  planFeaturesTable,
  tenantSubscriptionsTable,
  subscriptionHistoryTable,
  paymentMethodDefinitionsTable,
  tenantPaymentMethodsTable,
} from "@workspace/db";

type UserRole = "admin" | "production" | "qc" | "warehouse" | "sales";
type FabricRollRow = (typeof fabricRollsTable)["$inferSelect"];
type QcReportInsert = (typeof qcReportsTable)["$inferInsert"];
type WarehouseMovementInsert = (typeof warehouseMovementsTable)["$inferInsert"];
type RollStatus =
  | "IN_PRODUCTION"
  | "QC_PENDING"
  | "QC_PASSED"
  | "QC_FAILED"
  | "SENT_TO_DYEING"
  | "IN_DYEING"
  | "FINISHED"
  | "IN_STOCK"
  | "RESERVED"
  | "SOLD";
type QcResult = "PASS" | "FAIL" | "SECOND";

const PASSWORD = "Factory123!";
const BASE_DATE = new Date("2026-03-20T08:00:00.000Z");

const arabicFirstNames = [
  "أحمد", "محمد", "محمود", "عمر", "خالد", "ياسر", "مصطفى", "سامي", "وليد", "طارق",
  "حسام", "رامي", "حسن", "علاء", "أيمن", "شريف", "كريم", "إبراهيم", "عماد", "تامر",
  "نور", "هدى", "سارة", "آية", "منال", "رانيا", "أسماء", "إيمان", "فاطمة", "مها",
];
const arabicLastNames = [
  "عبدالرحمن", "النجار", "السيد", "العطار", "منصور", "شوقي", "حجازي", "قاسم", "مراد", "الرفاعي",
  "بدوي", "سليمان", "عثمان", "الشرقاوي", "صبري", "غنيم", "البنا", "الدسوقي", "فهمي", "حلمي",
];
const customerPrefixes = [
  "شركة", "مؤسسة", "مصنع", "مجموعة", "دار", "تجهيزات", "تجارة", "مخازن",
];
const customerIndustries = [
  "الملابس الجاهزة", "الزي الموحد", "الأقمشة", "المفروشات", "التريكو", "التصدير", "تجارة الجملة",
];
const customerCities = ["القاهرة", "المحلة الكبرى", "العاشر من رمضان", "الإسكندرية", "العبور", "السادات", "الجيزة"];
const yarnSuppliers = [
  "الغزل المتحد", "خيوط النيل", "سبين تكستايل", "الخيط الذهبي", "حلوان للغزل", "ألياف الشرق",
];
const dyeingSuppliers = [
  "الصباغة الحديثة", "ألوان الدلتا", "بيت الصباغة", "الرواد للتجهيز", "المعمل الأزرق", "ألوان المحلة",
];
const colors = ["أبيض", "أوف وايت", "أسود", "كحلي", "أزرق", "أحمر", "أخضر", "بيج", "رمادي", "زيتي"];
const dyedColors = ["أسود", "كحلي", "نبيتي", "أزرق ملكي", "أخضر زجاجي", "رمادي فاتح", "بيج رملي"];
const shades = ["فاتح", "متوسط", "غامق", "موحد", "درجة أولى"];
const fabricTypes = ["cotton", "polyester", "blend"];
const fabricTypeLabels: Record<string, string> = {
  cotton: "قطن",
  polyester: "بوليستر",
  blend: "مخلوط",
};
const qcDefects = [
  "بقع زيت خفيفة",
  "اختلاف بسيط في الشد",
  "وبر زائد",
  "علامات ماكينة",
  "اختلاف درجة اللون",
  "ثنيات عند الأطراف",
  "تفاوت في العرض",
];
const tenantSeeds = [
  { name: "مصنع النيل للنسيج", country: "مصر", plan: "enterprise" },
  { name: "مجموعة المحلة للأقمشة", country: "مصر", plan: "enterprise" },
  { name: "مصنع الشروق للغزل والصباغة", country: "الأردن", plan: "enterprise" },
] as const;

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260405);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function int(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function decimal(min: number, max: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round((min + random() * (max - min)) * factor) / factor;
}

function chance(probability: number): boolean {
  return random() < probability;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function sample<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, count);
}

function slugifyArabic(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function dateShift(days: number, hours = 0): Date {
  return new Date(BASE_DATE.getTime() + (((days * 24) + hours) * 60 * 60 * 1000));
}

function buildArabicName(index: number): string {
  return `${arabicFirstNames[index % arabicFirstNames.length]} ${arabicLastNames[(index * 3) % arabicLastNames.length]}`;
}

function buildCustomerName(index: number): string {
  return `${pick(customerPrefixes)} ${pick(customerIndustries)} ${customerCities[index % customerCities.length]}`;
}

function buildPhone(index: number): string {
  return `010${String(20000000 + index * 731).padStart(8, "0")}`;
}

function createStatusPool(total: number): RollStatus[] {
  const weighted: Array<[RollStatus, number]> = [
    ["IN_PRODUCTION", 10],
    ["QC_PENDING", 12],
    ["QC_PASSED", 10],
    ["QC_FAILED", 8],
    ["SENT_TO_DYEING", 8],
    ["IN_DYEING", 8],
    ["FINISHED", 10],
    ["IN_STOCK", 22],
    ["RESERVED", 7],
    ["SOLD", 5],
  ];

  const pool = weighted.flatMap(([status, weight]) => Array.from({ length: weight }, () => status));
  const result: RollStatus[] = [];
  for (let i = 0; i < total; i += 1) result.push(pick(pool));

  // Guarantee critical statuses exist in every tenant.
  result[0] = "IN_STOCK";
  result[1] = "SOLD";
  result[2] = "RESERVED";
  result[3] = "IN_DYEING";
  result[4] = "QC_FAILED";
  return shuffle(result);
}

async function resetDatabase() {
  await db.execute(sql`
    TRUNCATE TABLE
      invoices,
      warehouse_movements,
      qc_reports,
      dyeing_orders,
      sales_orders,
      fabric_rolls,
      warehouse_locations,
      warehouses,
      suppliers,
      customers,
      users,
      subscription_history,
      tenant_subscriptions,
      plan_features,
      plan_prices,
      plans,
      tenant_payment_methods,
      payment_method_audit_logs,
      payment_method_definitions,
      admin_audit_logs,
      platform_admins,
      billing_events,
      audit_logs,
      tenants
    RESTART IDENTITY CASCADE
  `);
}

async function seed() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const summary: Record<string, number> = {
    platformAdmins: 0,
    tenants: 0,
    users: 0,
    customers: 0,
    suppliers: 0,
    warehouses: 0,
    warehouseLocations: 0,
    productionOrders: 0,
    fabricRolls: 0,
    qcReports: 0,
    dyeingOrders: 0,
    warehouseMovements: 0,
    salesOrders: 0,
    invoices: 0,
    auditLogs: 0,
  };

  await resetDatabase();

  const seededPlans = await db.insert(plansTable).values([
    {
      code: "enterprise",
      nameAr: "الخطة المفتوحة",
      nameEn: "Open Plan",
      descriptionAr: "خطة واحدة تشمل جميع المزايا والحدود المفتوحة لكل الشركات.",
      descriptionEn: "A single open plan with all modules and broad limits for every tenant.",
      isActive: true,
      sortOrder: 1,
    },
  ]).returning();

  const planByCode = new Map(seededPlans.map((plan) => [plan.code, plan]));

  await db.insert(planPricesTable).values([
    { planId: planByCode.get("enterprise")!.id, interval: "monthly", currency: "EGP", amount: 499, trialDays: 0, localPaymentEnabled: true, isActive: true },
    { planId: planByCode.get("enterprise")!.id, interval: "yearly", currency: "EGP", amount: 4990, trialDays: 0, localPaymentEnabled: true, isActive: true },
  ]);

  await db.insert(planFeaturesTable).values([
    { planId: planByCode.get("enterprise")!.id, featureKey: "all_modules", labelAr: "كل الوحدات التشغيلية", labelEn: "All business modules", included: true, sortOrder: 1 },
    { planId: planByCode.get("enterprise")!.id, featureKey: "unlimited_users", labelAr: "عدد مستخدمين مفتوح", labelEn: "Open user capacity", included: true, sortOrder: 2 },
    { planId: planByCode.get("enterprise")!.id, featureKey: "unlimited_warehouses", labelAr: "عدد مخازن مفتوح", labelEn: "Open warehouse capacity", included: true, sortOrder: 3 },
    { planId: planByCode.get("enterprise")!.id, featureKey: "advanced_reports", labelAr: "تقارير ومراقبة متقدمة", labelEn: "Advanced reports and monitoring", included: true, sortOrder: 4 },
    { planId: planByCode.get("enterprise")!.id, featureKey: "manual_payments", labelAr: "الدفع اليدوي وطرق الدفع المحلية", labelEn: "Manual payments and local payment methods", included: true, sortOrder: 5 },
  ]);

  const seededPlanPrices = await db.select().from(planPricesTable);
  const planPriceByKey = new Map(seededPlanPrices.map((price) => [`${price.planId}:${price.interval}`, price]));

  const platformAdminPasswordHash = await bcrypt.hash("Admin123!", 10);
  const platformAdmins = await db.insert(platformAdminsTable).values([
    {
      email: "superadmin@fabric.local",
      passwordHash: platformAdminPasswordHash,
      fullName: "مدير المنصة",
      role: "super_admin",
      isActive: true,
      createdAt: dateShift(-60),
      updatedAt: dateShift(-1),
    },
    {
      email: "support@fabric.local",
      passwordHash: platformAdminPasswordHash,
      fullName: "مسؤول الدعم",
      role: "support_admin",
      isActive: true,
      createdAt: dateShift(-55),
      updatedAt: dateShift(-1),
    },
    {
      email: "billing@fabric.local",
      passwordHash: platformAdminPasswordHash,
      fullName: "مسؤول الفوترة",
      role: "billing_admin",
      isActive: true,
      createdAt: dateShift(-52),
      updatedAt: dateShift(-1),
    },
    {
      email: "security@fabric.local",
      passwordHash: platformAdminPasswordHash,
      fullName: "مسؤول الأمان",
      role: "security_admin",
      isActive: true,
      createdAt: dateShift(-50),
      updatedAt: dateShift(-1),
    },
    {
      email: "readonly@fabric.local",
      passwordHash: platformAdminPasswordHash,
      fullName: "مراجع المنصة",
      role: "readonly_admin",
      isActive: true,
      createdAt: dateShift(-48),
      updatedAt: dateShift(-1),
    },
  ]).returning();
  summary.platformAdmins += platformAdmins.length;

  await db.insert(paymentMethodDefinitionsTable).values([
    {
      code: "instapay",
      nameAr: "إنستا باي",
      nameEn: "InstaPay",
      category: "manual",
      isGloballyEnabled: true,
      supportsManualReview: true,
      sortOrder: 1,
      createdAt: dateShift(-60),
      updatedAt: dateShift(-1),
    },
    {
      code: "vodafone_cash",
      nameAr: "فودافون كاش",
      nameEn: "Vodafone Cash",
      category: "manual",
      isGloballyEnabled: true,
      supportsManualReview: true,
      sortOrder: 2,
      createdAt: dateShift(-60),
      updatedAt: dateShift(-1),
    },
  ]);

  let globalNameIndex = 0;

  for (let tenantIndex = 0; tenantIndex < tenantSeeds.length; tenantIndex += 1) {
    const tenantSeed = tenantSeeds[tenantIndex]!;
    const [tenant] = await db.insert(tenantsTable).values({
      name: tenantSeed.name,
      industry: "textile",
      country: tenantSeed.country,
      billingStatus: "active",
      currentPlan: tenantSeed.plan,
      subscriptionInterval: "monthly",
      trialEndsAt: null,
      isActive: true,
      createdAt: dateShift(-45 + tenantIndex * 3),
      updatedAt: dateShift(-2),
    }).returning();
    summary.tenants += 1;

    await db.insert(tenantPaymentMethodsTable).values([
      {
        tenantId: tenant.id,
        paymentMethodCode: "instapay",
        isActive: true,
        accountNumber: `instapay-${tenant.id}@factory.local`,
        accountName: tenant.name,
        instructionsAr: "حول المبلغ ثم ارفع صورة الإيصال.",
        instructionsEn: "Transfer the amount, then upload the receipt.",
        metadata: {},
        updatedBy: null,
        createdAt: dateShift(-35),
        updatedAt: dateShift(-2),
      },
      {
        tenantId: tenant.id,
        paymentMethodCode: "vodafone_cash",
        isActive: true,
        accountNumber: `010${String(tenant.id).padStart(8, "0")}`,
        accountName: tenant.name,
        instructionsAr: "أرسل المبلغ على الرقم المحدد ثم ارفع صورة التحويل.",
        instructionsEn: "Send the amount to the listed number then upload proof.",
        metadata: {},
        updatedBy: null,
        createdAt: dateShift(-35),
        updatedAt: dateShift(-2),
      },
    ]);

    const userBlueprints: Array<{ role: UserRole; title: string }> = [
      { role: "admin", title: "مدير النظام" },
      { role: "production", title: "مدير الإنتاج" },
      { role: "qc", title: "مفتش الجودة" },
      { role: "warehouse", title: "أمين المخزن" },
      { role: "sales", title: "مسؤول المبيعات" },
    ];

    const tenantUsers = await db.insert(usersTable).values(
      userBlueprints.map((blueprint, roleIndex) => {
        const fullName = buildArabicName(globalNameIndex + roleIndex);
        return {
          tenantId: tenant.id,
          email: `tenant${tenant.id}-${blueprint.role}@factory.local`,
          passwordHash,
          fullName,
          role: blueprint.role,
          isActive: true,
          createdAt: dateShift(-40 + tenantIndex, roleIndex),
          updatedAt: dateShift(-3),
        };
      }),
    ).returning();
    globalNameIndex += userBlueprints.length;
    summary.users += tenantUsers.length;

    const adminUser = tenantUsers.find((user) => user.role === "admin")!;
    const qcUser = tenantUsers.find((user) => user.role === "qc")!;
    const warehouseUser = tenantUsers.find((user) => user.role === "warehouse")!;
    const salesUser = tenantUsers.find((user) => user.role === "sales")!;
    const tenantPlan = planByCode.get(tenant.currentPlan)!;
    const tenantPlanPrice = tenant.subscriptionInterval
      ? planPriceByKey.get(`${tenantPlan.id}:${tenant.subscriptionInterval}`)
      : planPriceByKey.get(`${tenantPlan.id}:monthly`) ?? null;

    await db.insert(tenantSubscriptionsTable).values({
      tenantId: tenant.id,
      planId: tenantPlan.id,
      planPriceId: tenantPlanPrice?.id ?? null,
      amount: tenantPlanPrice?.amount ?? null,
      status: tenant.billingStatus,
      paymentProvider: "seed",
      paymentMethodCode: "instapay",
      startedAt: dateShift(-30 + tenantIndex),
      currentPeriodStart: dateShift(-15 + tenantIndex),
      currentPeriodEnd: tenant.subscriptionEndsAt ?? tenant.trialEndsAt ?? dateShift(15 + tenantIndex),
      trialEndsAt: tenant.trialEndsAt,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      metadata: { source: "seed" },
      createdAt: dateShift(-30 + tenantIndex),
      updatedAt: dateShift(-2),
    }).returning();

    await db.insert(subscriptionHistoryTable).values({
      tenantId: tenant.id,
      action: "SUBSCRIPTION_SEEDED",
      fromPlanId: null,
      toPlanId: tenantPlan.id,
      fromStatus: null,
      toStatus: tenant.billingStatus,
      actorUserId: adminUser.id,
      notes: "Initial seeded subscription",
      metadata: { interval: tenant.subscriptionInterval ?? "monthly" },
      createdAt: dateShift(-30 + tenantIndex),
    });

    const customers = await db.insert(customersTable).values(
      Array.from({ length: 12 + tenantIndex * 2 }, (_, index) => ({
        tenantId: tenant.id,
        name: buildCustomerName(index + tenantIndex * 10),
        email: `customer-${tenant.id}-${index + 1}@example.com`,
        phone: buildPhone(tenant.id * 100 + index),
        address: `${pick(customerCities)} - المنطقة الصناعية`,
        taxNumber: `TAX-${tenant.id}${String(index + 1).padStart(4, "0")}`,
        isActive: true,
        createdAt: dateShift(-35 + index),
        updatedAt: dateShift(-2),
      })),
    ).returning();
    summary.customers += customers.length;

    const suppliers = await db.insert(suppliersTable).values([
      ...yarnSuppliers.slice(tenantIndex, tenantIndex + 3).map((name, idx) => ({
        tenantId: tenant.id,
        name,
        category: "yarn",
        contactName: buildArabicName(globalNameIndex + idx),
        phone: buildPhone(tenant.id * 200 + idx),
        email: `supplier-yarn-${tenant.id}-${idx + 1}@example.com`,
        city: pick(customerCities),
        notes: "توريد خيوط قطنية ومخلوطة.",
        isActive: true,
        createdAt: dateShift(-50 + idx),
        updatedAt: dateShift(-4),
      })),
      ...dyeingSuppliers.slice(tenantIndex, tenantIndex + 3).map((name, idx) => ({
        tenantId: tenant.id,
        name,
        category: "dyeing",
        contactName: buildArabicName(globalNameIndex + idx + 3),
        phone: buildPhone(tenant.id * 220 + idx),
        email: `supplier-dyeing-${tenant.id}-${idx + 1}@example.com`,
        city: pick(customerCities),
        notes: "خدمات صباغة وتجهيز نهائي.",
        isActive: true,
        createdAt: dateShift(-48 + idx),
        updatedAt: dateShift(-4),
      })),
    ]).returning();
    summary.suppliers += suppliers.length;

    const warehouses = await db.insert(warehousesTable).values([
      {
        tenantId: tenant.id,
        name: "مخزن الخام",
        location: "المنطقة الشمالية",
        capacity: 450,
        isActive: true,
        createdAt: dateShift(-42),
        updatedAt: dateShift(-2),
      },
      {
        tenantId: tenant.id,
        name: "مخزن التام",
        location: "المنطقة الشرقية",
        capacity: 600,
        isActive: true,
        createdAt: dateShift(-42),
        updatedAt: dateShift(-2),
      },
      {
        tenantId: tenant.id,
        name: "مخزن الشحن",
        location: "بوابة التحميل",
        capacity: 300,
        isActive: true,
        createdAt: dateShift(-40),
        updatedAt: dateShift(-2),
      },
    ]).returning();
    summary.warehouses += warehouses.length;

    const locationsToInsert = warehouses.flatMap((warehouse, warehouseIndex) =>
      Array.from({ length: 8 }, (_, locationIndex) => ({
        tenantId: tenant.id,
        warehouseId: warehouse.id,
        code: `W${warehouseIndex + 1}-R${String(locationIndex + 1).padStart(2, "0")}`,
        rack: `رف ${warehouseIndex + 1}-${locationIndex + 1}`,
        level: `L${(locationIndex % 4) + 1}`,
        section: `قطاع ${String.fromCharCode(65 + (locationIndex % 4))}`,
        isActive: true,
        createdAt: dateShift(-38 + locationIndex),
        updatedAt: dateShift(-2),
      })),
    );
    const warehouseLocations = await db.insert(warehouseLocationsTable).values(locationsToInsert).returning();
    summary.warehouseLocations += warehouseLocations.length;

    const totalOrders = 14 + tenantIndex * 2;
    const orderRollCounts = Array.from({ length: totalOrders }, () => int(8, 14));
    const totalRolls = orderRollCounts.reduce((sum, value) => sum + value, 0);
    const statusPool = createStatusPool(totalRolls);
    let statusCursor = 0;

    const productionOrders = [];
    const insertedRolls: FabricRollRow[] = [];
    const qcReports: QcReportInsert[] = [];
    const warehouseMovements: WarehouseMovementInsert[] = [];
    const candidateForDyeing: FabricRollRow[] = [];
    const candidateForInventory: FabricRollRow[] = [];

    for (let orderIndex = 0; orderIndex < totalOrders; orderIndex += 1) {
      const rollCount = orderRollCounts[orderIndex]!;
      const fabricType = pick(fabricTypes);
      const gsm = decimal(120, 300);
      const width = decimal(150, 200);
      const rawColor = chance(0.6) ? "أبيض" : pick(colors);
      const orderDate = dateShift(-30 + orderIndex + tenantIndex);
      const orderNumber = `PO-${tenant.id}-${String(orderIndex + 1).padStart(3, "0")}`;
      const batchId = `B-${tenant.id}-${String(orderIndex + 1).padStart(3, "0")}`;

      const [order] = await db.insert(productionOrdersTable).values({
        tenantId: tenant.id,
        orderNumber,
        fabricType,
        gsm,
        width,
        rawColor,
        quantity: rollCount,
        status: orderIndex < totalOrders - 3 ? "COMPLETED" : "IN_PROGRESS",
        notes: `تشغيلة ${fabricTypeLabels[fabricType]} لعميل تصدير.`,
        rollsGenerated: rollCount,
        createdAt: orderDate,
        updatedAt: dateShift(-2),
      }).returning();
      productionOrders.push(order);
      summary.productionOrders += 1;

      const rollsForOrder = [];
      for (let rollIndex = 0; rollIndex < rollCount; rollIndex += 1) {
        const status = statusPool[statusCursor]!;
        statusCursor += 1;
        const hasFinishedColor = ["SENT_TO_DYEING", "IN_DYEING", "FINISHED", "IN_STOCK", "RESERVED", "SOLD"].includes(status);
        const color = hasFinishedColor ? pick(dyedColors) : rawColor;
        const warehouse = ["QC_PASSED", "FINISHED", "IN_STOCK", "RESERVED", "SOLD"].includes(status)
          ? pick([warehouses[1]!, warehouses[2]!])
          : null;
        const location = warehouse
          ? pick(warehouseLocations.filter((entry) => entry.warehouseId === warehouse.id))
          : null;
        const createdAt = dateShift(-29 + orderIndex, rollIndex % 8);

        rollsForOrder.push({
          tenantId: tenant.id,
          rollCode: `${orderNumber}-R${String(rollIndex + 1).padStart(3, "0")}`,
          batchId,
          productionOrderId: order.id,
          warehouseId: warehouse?.id ?? null,
          warehouseLocationId: location?.id ?? null,
          length: decimal(20, 80),
          weight: decimal(10, 40),
          color,
          gsm,
          width,
          fabricType,
          status,
          qrCode: `${orderNumber}-R${String(rollIndex + 1).padStart(3, "0")}`,
          notes: status === "QC_FAILED" ? "يحتاج إعادة فرز" : null,
          createdAt,
          updatedAt: dateShift(-1),
        });
      }

      const insertedForOrder = await db.insert(fabricRollsTable).values(rollsForOrder).returning();
      insertedRolls.push(...insertedForOrder);
      summary.fabricRolls += insertedForOrder.length;

      for (const roll of insertedForOrder) {
        if (["QC_PASSED", "QC_FAILED", "SENT_TO_DYEING", "IN_DYEING", "FINISHED", "IN_STOCK", "RESERVED", "SOLD"].includes(roll.status)) {
          const qcResult: QcResult = roll.status === "QC_FAILED" ? "FAIL" : "PASS";
          qcReports.push({
            tenantId: tenant.id,
            fabricRollId: roll.id,
            inspectedById: qcUser.id,
            result: qcResult,
            defects: qcResult === "FAIL" ? pick(qcDefects) : null,
            defectCount: qcResult === "FAIL" ? int(3, 8) : int(0, 2),
            images: [],
            notes: qcResult === "PASS" ? "مطابق للمواصفة" : "يحتاج إعادة تشغيل وفحص ثانٍ",
            inspectedAt: new Date(roll.createdAt.getTime() + 12 * 60 * 60 * 1000),
            createdAt: new Date(roll.createdAt.getTime() + 12 * 60 * 60 * 1000),
            updatedAt: dateShift(-1),
          });
        } else if (roll.status === "QC_PENDING" && chance(0.4)) {
          qcReports.push({
            tenantId: tenant.id,
            fabricRollId: roll.id,
            inspectedById: qcUser.id,
            result: "SECOND",
            defects: "تم طلب إعادة فحص بعد مراجعة أولية",
            defectCount: int(1, 3),
            images: [],
            notes: "في انتظار جولة فحص ثانية",
            inspectedAt: new Date(roll.createdAt.getTime() + 10 * 60 * 60 * 1000),
            createdAt: new Date(roll.createdAt.getTime() + 10 * 60 * 60 * 1000),
            updatedAt: dateShift(-1),
          });
        }

        if (roll.warehouseId && roll.warehouseLocationId) {
          warehouseMovements.push({
            tenantId: tenant.id,
            fabricRollId: roll.id,
            fromWarehouseId: null,
            toWarehouseId: roll.warehouseId,
            movedById: warehouseUser.id,
            reason: "استلام من خط الإنتاج",
            movedAt: new Date(roll.createdAt.getTime() + 18 * 60 * 60 * 1000),
            createdAt: new Date(roll.createdAt.getTime() + 18 * 60 * 60 * 1000),
          });
        }

        if (["SENT_TO_DYEING", "IN_DYEING", "FINISHED", "IN_STOCK", "RESERVED", "SOLD"].includes(roll.status)) {
          candidateForDyeing.push(roll);
        }
        if (["IN_STOCK", "RESERVED", "SOLD"].includes(roll.status)) {
          candidateForInventory.push(roll);
        }
      }

      await db.insert(auditLogsTable).values({
        tenantId: tenant.id,
        userId: adminUser.id,
        entityType: "production_order",
        entityId: order.id,
        action: "CREATE",
        changes: JSON.stringify({ orderNumber, rollsGenerated: rollCount, fabricType }),
        createdAt: dateShift(-29 + orderIndex, 2),
      });
      summary.auditLogs += 1;
    }

    if (qcReports.length > 0) {
      await db.insert(qcReportsTable).values(qcReports);
      summary.qcReports += qcReports.length;
    }

    if (warehouseMovements.length > 0) {
      await db.insert(warehouseMovementsTable).values(warehouseMovements);
      summary.warehouseMovements += warehouseMovements.length;
    }

    const dyeingGroups = shuffle(candidateForDyeing).reduce<FabricRollRow[][]>((groups, roll) => {
      const last = groups[groups.length - 1];
      if (!last || last.length >= 6) groups.push([roll]);
      else last.push(roll);
      return groups;
    }, []);

    const dyeingOrders = [];
    for (let index = 0; index < dyeingGroups.length; index += 1) {
      const rolls = dyeingGroups[index]!;
      const status = rolls.some((roll) => roll.status === "SENT_TO_DYEING")
        ? "SENT"
        : rolls.some((roll) => roll.status === "IN_DYEING")
          ? "IN_PROGRESS"
          : "COMPLETED";
      const [dyeOrder] = await db.insert(dyeingOrdersTable).values({
        tenantId: tenant.id,
        orderNumber: `DO-${tenant.id}-${String(index + 1).padStart(3, "0")}`,
        dyehouseName: pick(dyeingSuppliers),
        targetColor: pick(dyedColors),
        targetShade: pick(shades),
        status,
        sentAt: dateShift(-20 + index, 6),
        receivedAt: status === "COMPLETED" ? dateShift(-10 + index, 13) : null,
        notes: "تشطيب وصباغة حسب بطاقة التشغيل.",
        rollIds: rolls.map((roll) => roll.id),
        createdAt: dateShift(-21 + index),
        updatedAt: dateShift(-1),
      }).returning();
      dyeingOrders.push(dyeOrder);

      await db.insert(auditLogsTable).values({
        tenantId: tenant.id,
        userId: adminUser.id,
        entityType: "dyeing_order",
        entityId: dyeOrder.id,
        action: "CREATE",
        changes: JSON.stringify({ orderNumber: dyeOrder.orderNumber, rollCount: rolls.length }),
        createdAt: dateShift(-21 + index, 1),
      });
      summary.auditLogs += 1;
    }
    summary.dyeingOrders += dyeingOrders.length;

    const stockRolls = shuffle(candidateForInventory.filter((roll) => roll.status === "IN_STOCK"));
    const reservedRolls = shuffle(candidateForInventory.filter((roll) => roll.status === "RESERVED"));
    const soldRolls = shuffle(candidateForInventory.filter((roll) => roll.status === "SOLD"));

    const salesOrders = [];
    const invoices = [];
    const salesGroups = [
      ...reservedRolls.reduce<FabricRollRow[][]>((groups, roll) => {
        const last = groups[groups.length - 1];
        if (!last || last.length >= 5) groups.push([roll]);
        else last.push(roll);
        return groups;
      }, []),
      ...soldRolls.reduce<FabricRollRow[][]>((groups, roll) => {
        const last = groups[groups.length - 1];
        if (!last || last.length >= 5) groups.push([roll]);
        else last.push(roll);
        return groups;
      }, []),
      ...stockRolls.slice(0, 10).reduce<FabricRollRow[][]>((groups, roll) => {
        const last = groups[groups.length - 1];
        if (!last || last.length >= 5) groups.push([roll]);
        else last.push(roll);
        return groups;
      }, []),
    ];

    for (let index = 0; index < Math.min(salesGroups.length, 9 + tenantIndex); index += 1) {
      const rolls = salesGroups[index]!;
      const customer = customers[index % customers.length]!;
      const rollStatuses = new Set(rolls.map((roll) => roll.status));
      const status = rollStatuses.has("SOLD") ? "DELIVERED" : rollStatuses.has("RESERVED") ? "CONFIRMED" : "DRAFT";
      const totalAmount = rolls.reduce((sum, roll) => sum + (roll.length * 32 + roll.weight * 18), 0);
      const invoiceNumber = status === "DELIVERED" ? `INV-${tenant.id}-${String(index + 1).padStart(4, "0")}` : null;

      const [salesOrder] = await db.insert(salesOrdersTable).values({
        tenantId: tenant.id,
        orderNumber: `SO-${tenant.id}-${String(index + 1).padStart(3, "0")}`,
        customerId: customer.id,
        status,
        totalAmount: Math.round(totalAmount * 100) / 100,
        rollIds: rolls.map((roll) => roll.id),
        invoiceNumber,
        notes: status === "DELIVERED" ? "تم التسليم على مرحلتين." : "تحت التجهيز للشحن.",
        createdAt: dateShift(-12 + index),
        updatedAt: dateShift(-1),
      }).returning();
      salesOrders.push(salesOrder);

      await db.insert(auditLogsTable).values({
        tenantId: tenant.id,
        userId: salesUser.id,
        entityType: "sales_order",
        entityId: salesOrder.id,
        action: "CREATE",
        changes: JSON.stringify({ orderNumber: salesOrder.orderNumber, totalAmount: salesOrder.totalAmount }),
        createdAt: dateShift(-12 + index, 2),
      });
      summary.auditLogs += 1;

      if (invoiceNumber) {
        const invoicePaid = chance(0.7);
        invoices.push({
          tenantId: tenant.id,
          salesOrderId: salesOrder.id,
          customerId: customer.id,
          invoiceNumber,
          amount: salesOrder.totalAmount,
          currency: "EGP",
          status: invoicePaid ? "PAID" : "ISSUED",
          issuedAt: dateShift(-10 + index),
          dueAt: dateShift(-3 + index),
          paidAt: invoicePaid ? dateShift(-5 + index) : null,
          notes: "فاتورة مبيعات لرولات تامة.",
          createdAt: dateShift(-10 + index),
          updatedAt: dateShift(-1),
        });
      }
    }

    if (invoices.length > 0) {
      await db.insert(invoicesTable).values(invoices);
      summary.invoices += invoices.length;
    }
    summary.salesOrders += salesOrders.length;
  }

  await validateSeed();

  console.log("Seed completed successfully.");
  console.table(summary);
  console.log(`Default password for all seeded users: ${PASSWORD}`);
  console.log("Default password for all seeded platform admins: Admin123!");
}

async function validateSeed() {
  const duplicateRollCodes = await db.execute(sql`
    SELECT roll_code, COUNT(*)::int AS count
    FROM fabric_rolls
    GROUP BY roll_code
    HAVING COUNT(*) > 1
  `);
  if (duplicateRollCodes.rows.length > 0) {
    throw new Error(`Duplicate roll codes found: ${duplicateRollCodes.rows.length}`);
  }

  const brokenInvoiceTenants = await db.execute(sql`
    SELECT i.id
    FROM invoices i
    JOIN sales_orders so ON so.id = i.sales_order_id
    JOIN customers c ON c.id = i.customer_id
    WHERE i.tenant_id <> so.tenant_id OR i.tenant_id <> c.tenant_id
    LIMIT 1
  `);
  if (brokenInvoiceTenants.rows.length > 0) {
    throw new Error("Found invoice records crossing tenant boundaries");
  }

  const brokenRollLocations = await db.execute(sql`
    SELECT fr.id
    FROM fabric_rolls fr
    JOIN warehouse_locations wl ON wl.id = fr.warehouse_location_id
    WHERE fr.tenant_id <> wl.tenant_id
    LIMIT 1
  `);
  if (brokenRollLocations.rows.length > 0) {
    throw new Error("Found fabric rolls linked to warehouse locations from another tenant");
  }

  const invalidQcStates = await db.execute(sql`
    SELECT fr.id
    FROM fabric_rolls fr
    LEFT JOIN qc_reports qr ON qr.fabric_roll_id = fr.id
    WHERE fr.status IN ('QC_PASSED', 'QC_FAILED', 'SENT_TO_DYEING', 'IN_DYEING', 'FINISHED', 'IN_STOCK', 'RESERVED', 'SOLD')
      AND qr.id IS NULL
    LIMIT 1
  `);
  if (invalidQcStates.rows.length > 0) {
    throw new Error("Found post-QC rolls without QC reports");
  }

  const invalidSalesStates = await db.execute(sql`
    SELECT fr.id
    FROM fabric_rolls fr
    LEFT JOIN sales_orders so ON fr.id = ANY(so.roll_ids)
    WHERE fr.status IN ('RESERVED', 'SOLD') AND so.id IS NULL
    LIMIT 1
  `);
  if (invalidSalesStates.rows.length > 0) {
    throw new Error("Found reserved or sold rolls without a sales order");
  }

  const soldWithoutDelivery = await db.execute(sql`
    SELECT fr.id
    FROM fabric_rolls fr
    JOIN sales_orders so ON fr.id = ANY(so.roll_ids)
    WHERE fr.status = 'SOLD' AND so.status <> 'DELIVERED'
    LIMIT 1
  `);
  if (soldWithoutDelivery.rows.length > 0) {
    throw new Error("Found sold rolls attached to non-delivered sales orders");
  }

  const invalidDyeingStates = await db.execute(sql`
    SELECT fr.id
    FROM fabric_rolls fr
    LEFT JOIN dyeing_orders d ON fr.id = ANY(d.roll_ids)
    WHERE fr.status IN ('SENT_TO_DYEING', 'IN_DYEING') AND d.id IS NULL
    LIMIT 1
  `);
  if (invalidDyeingStates.rows.length > 0) {
    throw new Error("Found dyeing rolls without dyeing orders");
  }

  const rollCounts = await db.select({
    tenantId: productionOrdersTable.tenantId,
    orderId: productionOrdersTable.id,
    quantity: productionOrdersTable.quantity,
    rollsGenerated: productionOrdersTable.rollsGenerated,
  }).from(productionOrdersTable);

  for (const order of rollCounts) {
    const relatedRolls = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM fabric_rolls
      WHERE production_order_id = ${order.orderId}
    `);
    const actualCount = Number(relatedRolls.rows[0]?.count ?? 0);
    if (actualCount !== order.quantity || actualCount !== order.rollsGenerated) {
      throw new Error(`Production order ${order.orderId} has inconsistent roll counts`);
    }
  }

  const perTenantCounts = await db.execute(sql`
    SELECT t.name, COUNT(fr.id)::int AS rolls
    FROM tenants t
    LEFT JOIN fabric_rolls fr ON fr.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.id
  `);
  console.log("Roll counts by tenant:");
  console.table(perTenantCounts.rows);
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
