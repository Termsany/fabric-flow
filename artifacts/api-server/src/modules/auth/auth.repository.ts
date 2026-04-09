import { db, platformAdminsTable, tenantsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const authRepository = {
  findUserByEmail(email: string) {
    return db.select().from(usersTable).where(eq(usersTable.email, email));
  },

  findUserById(id: number) {
    return db.select().from(usersTable).where(eq(usersTable.id, id));
  },

  updateUserLastLogin(id: number) {
    return db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, id));
  },

  updateUserPassword(id: number, passwordHash: string) {
    return db.update(usersTable)
      .set({ passwordHash, passwordUpdatedAt: new Date() })
      .where(eq(usersTable.id, id));
  },

  createTenant(values: typeof tenantsTable.$inferInsert) {
    return db.insert(tenantsTable).values(values).returning();
  },

  createUser(values: typeof usersTable.$inferInsert) {
    return db.insert(usersTable).values(values).returning();
  },

  createTenantWithAdmin(input: {
    tenant: typeof tenantsTable.$inferInsert;
    user: typeof usersTable.$inferInsert;
  }) {
    return db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenantsTable).values(input.tenant).returning();
      const [user] = await tx.insert(usersTable).values({
        ...input.user,
        tenantId: tenant.id,
      }).returning();

      return { tenant, user };
    });
  },

  findPlatformAdminById(id: number) {
    return db.select().from(platformAdminsTable).where(eq(platformAdminsTable.id, id));
  },

  updatePlatformAdminLastLogin(id: number) {
    return db.update(platformAdminsTable).set({ lastLoginAt: new Date() }).where(eq(platformAdminsTable.id, id));
  },

  updatePlatformAdminPassword(id: number, passwordHash: string) {
    return db.update(platformAdminsTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(platformAdminsTable.id, id));
  },

  upsertSuperAdminPlatformAccount(values: {
    email: string;
    passwordHash: string;
    fullName: string;
  }) {
    return db.insert(platformAdminsTable).values({
      email: values.email,
      passwordHash: values.passwordHash,
      fullName: values.fullName,
      role: "super_admin",
      isActive: true,
    }).onConflictDoUpdate({
      target: platformAdminsTable.email,
      set: {
        passwordHash: values.passwordHash,
        fullName: values.fullName,
        role: "super_admin",
        isActive: true,
        updatedAt: new Date(),
      },
    }).returning();
  },
};
