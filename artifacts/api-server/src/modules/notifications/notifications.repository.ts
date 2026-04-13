import { and, desc, eq, gte } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

export const notificationsRepository = {
  listNotifications(tenantId: number, options: { unreadOnly?: boolean; limit: number; offset: number }) {
    const conditions = [eq(notificationsTable.tenantId, tenantId)];
    if (options.unreadOnly) {
      conditions.push(eq(notificationsTable.isRead, false));
    }

    return db.select().from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  },

  findNotificationById(tenantId: number, id: number) {
    return db.select().from(notificationsTable)
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.tenantId, tenantId)));
  },

  insertNotification(values: typeof notificationsTable.$inferInsert) {
    return db.insert(notificationsTable).values(values).returning();
  },

  markNotificationRead(tenantId: number, id: number, readAt: Date) {
    return db.update(notificationsTable)
      .set({ isRead: true, readAt })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.tenantId, tenantId)))
      .returning();
  },

  findRecentNotification(tenantId: number, options: {
    type: string;
    entityType?: string | null;
    entityId?: number | null;
    since: Date;
  }) {
    const conditions = [
      eq(notificationsTable.tenantId, tenantId),
      eq(notificationsTable.type, options.type),
      gte(notificationsTable.createdAt, options.since),
    ];
    if (options.entityType != null) {
      conditions.push(eq(notificationsTable.entityType, options.entityType));
    }
    if (options.entityId != null) {
      conditions.push(eq(notificationsTable.entityId, options.entityId));
    }

    return db.select().from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(1);
  },
};
