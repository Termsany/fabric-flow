import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireTenantRole } from "../../lib/auth";
import { formatValidationError } from "../../lib/request-validation";
import { operationalSearchService } from "./operational-search.service";

const OperationalSearchQuery = z.object({
  q: z.coerce.string().trim().min(1, "Search query is required"),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

const router = Router();

router.get(
  "/search/operational",
  requireAuth,
  requireTenantRole(["production_user", "dyeing_user", "qc_user", "warehouse_user", "sales_user"]),
  async (req, res): Promise<void> => {
  const parsed = OperationalSearchQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: formatValidationError(parsed.error) });
    return;
  }

  const results = await operationalSearchService.search(req.user!.tenantId, parsed.data.q, {
    limit: parsed.data.limit,
  });

  res.json({
    query: parsed.data.q,
    results,
  });
});

export default router;
