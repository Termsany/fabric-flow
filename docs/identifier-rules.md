# Operational Identifier Rules

This document records the identifier conventions currently used by the textile ERP workflow. These rules are intentionally incremental and preserve existing API response shapes.

## Canonical Display References

- Fabric rolls use `rollCode` as the primary human-facing identifier. Numeric `id` remains the internal route/database identifier.
- Production orders use `orderNumber` as the primary human-facing identifier. Numeric `id` remains valid for route lookup and backend search.
- Dyeing orders use `orderNumber` as the primary human-facing identifier.
- Sales orders use `orderNumber` as the primary human-facing identifier. `invoiceNumber` is a secondary reference once invoicing is assigned.
- Warehouses currently use `name` for display and numeric `id` for movement references.
- Warehouse movements use numeric movement `id` internally; movement lists can also be searched by fabric roll id, source warehouse id, destination warehouse id, or movement reason.

## Search Behavior

Search inputs are optional and do not change existing list behavior when omitted.

- `GET /search/operational?q=` performs a lightweight global operational search across fabric rolls, production orders, sales orders, and warehouses. Results include a normalized `type`, `label`, `subtitle`, `href`, and `metadata` block for UI linking.
- `GET /fabric-rolls?search=` matches `rollCode`, `batchId`, `qrCode`, numeric roll `id`, and numeric `productionOrderId`.
- `GET /production-orders?search=` matches `orderNumber` and numeric production order `id`.
- `GET /dyeing-orders?search=` matches `orderNumber`, `dyehouseName`, `targetColor`, and numeric dyeing order `id`.
- `GET /warehouse-movements?search=` matches movement `reason`, numeric movement `id`, numeric `fabricRollId`, numeric `fromWarehouseId`, and numeric `toWarehouseId`.
- `GET /sales-orders?search=` matches `orderNumber`, `invoiceNumber`, numeric sales order `id`, and numeric `customerId`.

## Naming Notes

- Keep database `id` fields numeric and route-safe.
- Prefer showing stable business references (`rollCode`, `orderNumber`, `invoiceNumber`) in UI tables.
- Use `#id` only when a human-facing reference is not available yet, such as warehouse movement rows that currently store warehouse ids only.
- Avoid introducing new prefixes unless the identifier is persisted. Display-only prefixes can make search and support harder if users cannot copy the exact stored value.

## Future Improvements

- Add warehouse movement response enrichment with roll code and warehouse names to reduce `#id` display in the UI.
- Add indexed search support if list sizes grow enough that `ilike` queries become slow.
- Consider persisted warehouse codes if operators need barcode-like warehouse references.
