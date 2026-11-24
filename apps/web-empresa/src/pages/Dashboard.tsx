import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { getCurrentCommission, listProductRefs, listSales } from '../dashboard/api';
import { PERIOD_LABEL, summarize, type CategoryRef, type Period, type ProductRef, type SaleOrder } from '../lib/dashboard-rules';
import { formatCents } from '../lib/money';
import { usePartner } from '../partner/PartnerContext';
import { listCategories } from '../products/api';

const COLORS = ['#000851', '#f05219', '#3b82f6', '#16a34a', '#b45309', '#7c3aed', '#0891b2', '#94a3b8'];
const NAVY = '#000851';
const ORANGE = '#f05219';

type Metric = 'units' | 'revenue';

const shorten = (text: string, max = 18) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const formatDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const formatInt = (value: number) => value.toLocaleString('pt-BR');
const formatPercent = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint ? <span className="kpi-hint">{hint}</span> : null}
    </div>
  );
}

export function Dashboard() {
  const { partner } = usePartner();
  const partnerId = partner?.id;

  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>(30);
  const [metric, setMetric] = useState<Metric>('units');
  const [commission, setCommission] = useState<{ percent: number; special: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    try {
      const [sales, refs, cats] = await Promise.all([listSales(partnerId), listProductRefs(partnerId), listCategories()]);
      setOrders(sales);
      setProducts(refs);
      setCategories(cats);
      setError('');
      // A taxa atual é informativa: se falhar, o painel continua.
      getCurrentCommission(partnerId).then(setCommission, () => setCommission(null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo(() => summarize(orders, products, categories, period), [orders, products, categories, period]);

  const topProducts = data.topProducts.slice(0, 8).map((item) => ({ ...item, label: shorten(item.name) }));
  const totalUnits = data.unitsSold || 1;
  const hasSales = data.ordersCompleted > 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Painel de vendas</h1>
          <p className="muted">O que mais sai da sua loja. Conta como venda o pedido já retirado pelo cliente ou entregue.</p>
        </div>
        <div className="dash-controls">
          <select value={String(period)} onChange={(e) => setPeriod(e.target.value === 'all' ? 'all' : (Number(e.target.value) as Period))} aria-label="Período">
            {Object.entries(PERIOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      {loading && orders.length === 0 && !error ? (
        <p className="muted">Carregando…</p>
      ) : (
        <>
          <div className="kpi-grid">
            <Kpi label="Vendas brutas" value={formatCents(data.revenueCents)} hint={PERIOD_LABEL[String(period)]} />
            <Kpi
              label="Comissão FireStock"
              value={formatCents(data.commissionCents)}
              hint={commission ? `Taxa atual: ${formatPercent(commission.percent)}${commission.special ? ' (taxa especial)' : ''}` : undefined}
            />
            <Kpi label="Valor líquido" value={formatCents(data.netCents)} hint="vendas brutas − comissão" />
            <Kpi label="Itens vendidos" value={formatInt(data.unitsSold)} />
            <Kpi label="Pedidos concluídos" value={formatInt(data.ordersCompleted)} hint={data.notCompleted > 0 ? `${data.notCompleted} não concluídos` : undefined} />
            <Kpi label="Ticket médio" value={formatCents(data.avgTicketCents)} />
            <Kpi label="Reservas em aberto" value={formatInt(data.openReservations)} hint="aguardando retirada ou entrega" />
          </div>

          {!hasSales ? (
            <div className="card empty">
              <h2>Ainda não há vendas neste período</h2>
              <p className="muted">
                As vendas aparecem aqui quando um cliente reserva um produto seu no app e retira na loja. Tente um período maior ou volte mais tarde.
              </p>
            </div>
          ) : (
            <>
              <div className="dash-grid">
                <section className="card chart-card">
                  <div className="chart-head">
                    <div>
                      <h2>Produtos mais vendidos</h2>
                      <p className="muted card-subtitle">Os 8 primeiros do período.</p>
                    </div>
                    <div className="segmented" role="group" aria-label="Métrica">
                      <button className={metric === 'units' ? 'active' : ''} onClick={() => setMetric('units')} aria-pressed={metric === 'units'}>
                        Unidades
                      </button>
                      <button className={metric === 'revenue' ? 'active' : ''} onClick={() => setMetric('revenue')} aria-pressed={metric === 'revenue'}>
                        Receita
                      </button>
                    </div>
                  </div>
                  <div className="chart-box" style={{ height: Math.max(220, topProducts.length * 42 + 20) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" allowDecimals={false} tickFormatter={metric === 'revenue' ? (v: number) => formatCents(v) : undefined} />
                        <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 13 }} />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          formatter={(value) => (metric === 'revenue' ? formatCents(Number(value)) : `${formatInt(Number(value))} un.`)}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                        />
                        <Bar dataKey={metric === 'units' ? 'units' : 'revenueCents'} name={metric === 'units' ? 'Vendidos' : 'Receita'} fill={metric === 'units' ? NAVY : ORANGE} radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="card chart-card">
                  <h2>Vendas por categoria</h2>
                  <p className="muted card-subtitle">Participação nas unidades vendidas.</p>
                  <div className="chart-box" style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.byCategory} dataKey="units" nameKey="category" innerRadius={52} outerRadius={84} paddingAngle={2}>
                          {data.byCategory.map((entry, index) => (
                            <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${formatInt(Number(value))} un.`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="legend">
                    {data.byCategory.map((entry, index) => (
                      <li key={entry.category}>
                        <span className="dot" style={{ background: COLORS[index % COLORS.length] }} />
                        <span className="legend-name">{entry.category}</span>
                        <span className="muted">{formatInt(entry.units)} un. · {Math.round((entry.units / totalUnits) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section className="card chart-card">
                <h2>Receita por dia</h2>
                <p className="muted card-subtitle">Vendas concluídas (retiradas ou entregues), no dia da conclusão.</p>
                <div className="chart-box" style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.daily} margin={{ left: 8, right: 16 }}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={24} />
                      <YAxis tickFormatter={(v: number) => formatCents(v)} width={84} />
                      <Tooltip formatter={(value) => formatCents(Number(value))} labelFormatter={(label) => formatDay(String(label))} />
                      <Area type="monotone" dataKey="revenueCents" name="Receita" stroke={ORANGE} strokeWidth={2} fill="url(#revenueFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card" style={{ marginTop: 24 }}>
                <h2>Ranking de produtos</h2>
                <p className="muted card-subtitle">Todos os produtos com venda no período.</p>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Produto</th>
                        <th>Categoria</th>
                        <th className="num">Unidades</th>
                        <th className="num">Receita</th>
                        <th className="num">% das unidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((item, index) => (
                        <tr key={item.productId}>
                          <td>{index + 1}</td>
                          <td className="strong">{item.name}</td>
                          <td>{item.category}</td>
                          <td className="num">{formatInt(item.units)}</td>
                          <td className="num">{formatCents(item.revenueCents)}</td>
                          <td className="num">{Math.round((item.units / totalUnits) * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
