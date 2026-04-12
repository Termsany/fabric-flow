import { useState } from "react";
import { Link } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { isTenantAdminRole } from "@/lib/roles";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { FABRIC_ROLL_WORKFLOW_STATUS, SALES_WORKFLOW_STATUS } from "@/lib/workflow-statuses";
import {
  useListCustomers,
  useCreateCustomer,
  useListSalesOrders,
  useCreateSalesOrder,
  useUpdateSalesOrder,
  useListFabricRolls,
  getListCustomersQueryKey,
  getListSalesOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Users, ShoppingCart } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";

export function SalesPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"orders" | "customers">("orders");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedRolls, setSelectedRolls] = useState<number[]>([]);
  const [custForm, setCustForm] = useState({ name: "", email: "", phone: "", address: "", taxNumber: "" });
  const [orderForm, setOrderForm] = useState({ customerId: "", totalAmount: "", notes: "" });

  const normalizedOrderSearch = orderSearch.trim();
  const normalizedCustomerSearch = customerSearch.trim();
  const { data: customers, isLoading: custLoading, error: customersError } = useListCustomers(
    tab === "customers" && normalizedCustomerSearch ? { search: normalizedCustomerSearch } : {},
  );
  const { data: orders, isLoading: ordLoading, error: ordersError } = useListSalesOrders(
    normalizedOrderSearch ? { search: normalizedOrderSearch } : {},
  );
  const { data: availableRolls, error: rollsError } = useListFabricRolls({ status: FABRIC_ROLL_WORKFLOW_STATUS.inStock, limit: 200 });
  const customersCount = (customers || []).length;

  const createCustomer = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setShowCreateCustomer(false);
        setCustForm({ name: "", email: "", phone: "", address: "", taxNumber: "" });
      },
    },
  });

  const createOrder = useCreateSalesOrder({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() });
        setShowCreateOrder(false);
        setOrderForm({ customerId: "", totalAmount: "", notes: "" });
        setSelectedRolls([]);
      },
    },
  });

  const updateOrder = useUpdateSalesOrder({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey() }),
    },
  });

  const toggleRoll = (id: number) => setSelectedRolls((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);

  const accessError = [customersError, ordersError, rollsError].find(Boolean) as
    | {
        status?: number;
      }
    | undefined;

  const accessErrorMessage = (() => {
    if (!accessError) return null;
    if (accessError.status === 403) return t.featureRequiresPro;
    if (accessError.status === 402) return t.subscriptionInactiveMessage;
    return t.failedToLoadData;
  })();

  return (
    <Layout>
      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {([
            { key: "orders", label: t.salesOrders, icon: ShoppingCart },
            { key: "customers", label: t.customers, icon: Users },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
        {tab === "customers" ? (
          <button
            onClick={() => setShowCreateCustomer(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t.createCustomer}
          </button>
        ) : (
          <button
            onClick={() => setShowCreateOrder(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t.createSalesOrder}
          </button>
        )}
      </div>

      {accessErrorMessage && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <div className="font-medium">{accessErrorMessage}</div>
          {accessError?.status === 403 && isTenantAdminRole(user?.role) && (
            <div className="mt-3">
              <Link href="/billing" className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700">
                {t.goToBilling}
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <input
          value={tab === "orders" ? orderSearch : customerSearch}
          onChange={(event) => tab === "orders" ? setOrderSearch(event.target.value) : setCustomerSearch(event.target.value)}
          placeholder={tab === "orders"
            ? `${t.search} ${t.orderNumber} / ${t.invoiceNumber} / ID...`
            : `${t.search} ${t.customerName}...`}
          className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Create Customer Modal */}
      {showCreateCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.createCustomer}</h2>
              <button onClick={() => setShowCreateCustomer(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createCustomer.mutate({ data: { name: custForm.name, email: custForm.email || undefined, phone: custForm.phone || undefined, address: custForm.address || undefined, taxNumber: custForm.taxNumber || undefined } }); }} className="p-6 space-y-4">
              {[
                { key: "name", label: t.customerName, required: true },
                { key: "email", label: t.email },
                { key: "phone", label: t.phone },
                { key: "address", label: t.address },
                { key: "taxNumber", label: t.taxNumber },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={custForm[key as keyof typeof custForm]}
                    onChange={(e) => setCustForm({ ...custForm, [key]: e.target.value })}
                    required={required}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateCustomer(false)} className="px-4 py-2 text-sm text-slate-600">{t.cancel}</button>
                <button type="submit" disabled={createCustomer.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {createCustomer.isPending ? t.loading : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t.createSalesOrder}</h2>
              <button onClick={() => setShowCreateOrder(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); createOrder.mutate({ data: { customerId: parseInt(orderForm.customerId), totalAmount: parseFloat(orderForm.totalAmount), rollIds: selectedRolls, notes: orderForm.notes || undefined } }); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.customer}</label>
                <select value={orderForm.customerId} onChange={(e) => setOrderForm({ ...orderForm, customerId: e.target.value })} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">{t.search}...</option>
                  {(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.totalAmount}</label>
                <input type="number" step="0.01" value={orderForm.totalAmount} onChange={(e) => setOrderForm({ ...orderForm, totalAmount: e.target.value })} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.selectRolls} ({t.inStock})</label>
                <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                  {(availableRolls || []).length === 0 ? (
                    <div className="text-sm text-slate-400 text-center py-3">{t.noRolls}</div>
                  ) : (
                    (availableRolls || []).map((roll) => (
                      <label key={roll.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={selectedRolls.includes(roll.id)} onChange={() => toggleRoll(roll.id)} className="rounded border-slate-300 text-indigo-600" />
                        <span className="text-sm font-mono text-slate-700">{roll.rollCode}</span>
                        <span className="text-xs text-slate-400">{roll.length}m / {roll.weight}kg</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.notes}</label>
                <textarea value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateOrder(false)} className="px-4 py-2 text-sm text-slate-600">{t.cancel}</button>
                <button type="submit" disabled={createOrder.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {createOrder.isPending ? t.loading : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {tab === "customers" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.customerName}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.email}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.phone}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.taxNumber}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {custLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (<td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>))}</tr>)
                ) : accessErrorMessage ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">{accessErrorMessage}</td></tr>
                ) : (customers || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <div>{t.noCustomersYet}</div>
                        <div className="text-xs text-slate-500">{t.emptyCustomersHint}</div>
                        <button
                          type="button"
                          onClick={() => setShowCreateCustomer(true)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          {t.emptyCustomersCta}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (customers || []).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{c.email || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{c.taxNumber || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {c.isActive ? t.active : t.inactive}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {tab === "orders" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.orderNumber}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.customer}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.totalAmount}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.fabricRolls}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.status}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.date}</th>
                  <th className="text-start px-4 py-3 font-medium text-slate-600">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (<td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse"></div></td>))}</tr>)
                ) : accessErrorMessage ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{accessErrorMessage}</td></tr>
                ) : (orders || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <div>{t.noSalesOrdersYet}</div>
                        <div className="text-xs text-slate-500">{t.emptySalesOrdersHint}</div>
                        {customersCount === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTab("customers");
                              setShowCreateCustomer(true);
                            }}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            {t.emptySalesOrdersCustomerCta}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowCreateOrder(true)}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            {t.emptySalesOrdersCta}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  (orders || []).map((order) => {
                    const customer = (customers || []).find((c) => c.id === order.customerId);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{customer?.name || `#${order.customerId}`}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{formatNumber(order.totalAmount, lang)}</td>
                        <td className="px-4 py-3 text-slate-500">{(order.rollIds || []).length}</td>
                        <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(order.createdAt, lang)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {order.status === SALES_WORKFLOW_STATUS.draft && (
                              <button onClick={() => updateOrder.mutate({ id: order.id, data: { status: SALES_WORKFLOW_STATUS.confirmed } })}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium">{(t as unknown as Record<string, string>)[SALES_WORKFLOW_STATUS.confirmed] || SALES_WORKFLOW_STATUS.confirmed}</button>
                            )}
                            {order.status === SALES_WORKFLOW_STATUS.confirmed && (
                              <button onClick={() => updateOrder.mutate({ id: order.id, data: { status: SALES_WORKFLOW_STATUS.delivered } })}
                                className="text-green-600 hover:text-green-800 text-xs font-medium">{(t as unknown as Record<string, string>)[SALES_WORKFLOW_STATUS.delivered] || SALES_WORKFLOW_STATUS.delivered}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
