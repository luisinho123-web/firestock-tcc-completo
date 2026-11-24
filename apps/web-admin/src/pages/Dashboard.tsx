import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { countConsumers, countOpenReservations, listCategories, listPartners, listProducts, listSales } from '../admin/api';
import {
  PERIOD_LABEL,
  periodStart,
  summarizeAdmin,
  type CategoryRef,
  type PartnerRef,
  type Period,
  type ProductRef,
  type SaleOrder,
  type SaleStatus,
} from '../lib/admin-rules';
import { formatCents } from '../lib/money';

const COLORS = ['#000851', '#f05219', '#3b82f6', '#16a34a', '#b45309', '#7c3aed', '#0891b2', '#94a3b8'];
const NAVY = '#000851';
const ORANGE = '#f05219';
const STATUS_COLOR: Record<SaleStatus, string> = {
  picked_up: '#16a34a',
  confirmed: '#000851',
  pending: '#3b82f6',
  cancelled: '#dc2626',
  expired: '#b45309',
  no_show: '#94a3b8',
};

type Metric = 'units' | 'revenue';

const shorten = (text: string, max = 18) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const formatDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const formatInt = (value: number) => value.toLocaleString('pt-BR');
const formatPercent = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

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
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [partners, setPartners] = useState<PartnerRef[]>([]);
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [totalConsumers, setTotalConsumers] = useState(0);
  const [newConsumers, setNewConsumers] = useState(0);
  const [openReservations, setOpenReservations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>(30);
  const [metric, setMetric] = useState<Metric>('units');
  const [productMetric, setProductMetric] = useState<Metric>('units');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = periodStart(period, new Date())?.toISOString() ?? null;
      const [sales, productList, partnerList, categoryList, consumers, newOnes, open] = await Promise.all([
        listSales(since),
        listProducts(),
        listPartners(),
        listCategories(),
        countConsumers(null),
        countConsumers(since),
        countOpenReservations(),
      ]);
      setOrders(sales);
      setProducts(productList);
      setPartners(partnerList);
      setCategories(categoryList);
      setTotalConsumers(consumers);
      setNewConsumers(newOnes);
      setOpenReservations(open);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const data = useMemo(() => summarizeAdmin(orders, products, partners, categories, period), [orders, products, partners, categories, period]);

  const hasSales = data.ordersCompleted > 0;
  const totalUnits = data.unitsSold;
  const totalPartnerRevenue = data.revenueCents;
  const topPartners = data.byPartner
    .slice()
    .sort((a, b) => (metric === 'units' ? b.units - a.units || b.revenueCents - a.revenueCents : b.revenueCents - a.revenueCents || b.units - a.units))
    .slice(0, 8)
    .map((item) => ({ ...item, label: shorten(item.name) }));
  const topProducts = data.topProducts
    .slice()
    .sort((a, b) => (productMetric === 'units' ? b.units - a.units || b.revenueCents - a.revenueCents : b.revenueCents - a.revenueCents || b.units - a.units))
    .slice(0, 8)
    .map((item) => ({ ...item, label: shorten(item.name) }));
  const statuses = data.byStatus.filter((entry) => entry.count > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Painel do administrador</h1>
          <p className="muted">Visão geral da plataforma: todas as empresas, reservas e usuários.</p>
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

      {loading && orders.length === 0 && partners.length === 0 && !error ? (
        <p className="muted">Carregando…</p>
      ) : (
        <>
          <div className="kpi-grid">
            <Kpi
              label="Receita da plataforma"
              value={formatCents(data.platformRevenueCents)}
              hint={`comissões · ${data.revenueCents > 0 ? `${formatPercent((data.platformRevenueCents / data.revenueCents) * 100)} do volume` : PERIOD_LABEL[String(period)]}`}
            />
            <Kpi label="Volume vendido" value={formatCents(data.revenueCents)} hint="total das lojas (GMV)" />
            <Kpi label="Itens salvos" value={formatInt(data.unitsSold)} hint="unidades vendidas" />
            <Kpi label="Reservas" value={formatInt(data.ordersInPeriod)} hint={`${formatInt(data.ordersCompleted)} concluídas · ${formatInt(openReservations)} em aberto agora`} />
            <Kpi label="Usuários ativos" value={formatInt(data.activeUsers)} hint={`de ${formatInt(totalConsumers)} cadastrados · ${formatInt(newConsumers)} novos`} />
            <Kpi label="Empresas aprovadas" value={formatInt(data.partnerCounts.approved)} hint={`${formatInt(data.partnerCounts.pending)} aguardando aprovação`} />
            <Kpi label="Ticket médio" value={formatCents(data.avgTicketCents)} />
          </div>

          {data.ordersInPeriod === 0 ? (
            <div className="card empty">
              <h2>Ainda não há reservas neste período</h2>
              <p className="muted">
                Os números aparecem quando clientes reservam e retiram produtos no app. Tente um período maior ou volte mais tarde.
              </p>
            </div>
          ) : (
            <>
              <section className="card chart-card" style={{ marginBottom: 24 }}>
                <h2>Volume vendido e receita por dia</h2>
                <p className="muted card-subtitle">
                  Vendas concluídas (retiradas ou entregues) de todas as empresas, no dia da conclusão, e a comissão do FireStock sobre elas.
                </p>
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
                      <Area type="monotone" dataKey="revenueCents" name="Volume vendido" stroke={ORANGE} strokeWidth={2} fill="url(#revenueFill)" />
                      <Legend verticalAlign="top" height={28} />
                      <Area type="monotone" dataKey="commissionCents" name="Receita da plataforma" stroke={NAVY} strokeWidth={2} fill="transparent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="dash-grid">
                <section className="card chart-card">
                  <div className="chart-head">
                    <div>
                      <h2>Empresas que mais vendem</h2>
                      <p className="muted card-subtitle">As 8 primeiras do período.</p>
                    </div>
                    <div className="segmented" role="group" aria-label="Métrica das empresas">
                      <button className={metric === 'units' ? 'active' : ''} onClick={() => setMetric('units')} aria-pressed={metric === 'units'}>
                        Unidades
                      </button>
                      <button className={metric === 'revenue' ? 'active' : ''} onClick={() => setMetric('revenue')} aria-pressed={metric === 'revenue'}>
                        Receita
                      </button>
                    </div>
                  </div>
                  <div className="chart-box" style={{ height: Math.max(220, topPartners.length * 42 + 20) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topPartners} layout="vertical" margin={{ left: 8, right: 24 }}>
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
                  <h2>Reservas por status</h2>
                  <p className="muted card-subtitle">{formatInt(data.ordersInPeriod)} reservas no período.</p>
                  <div className="chart-box" style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statuses} dataKey="count" nameKey="label" innerRadius={52} outerRadius={84} paddingAngle={2}>
                          {statuses.map((entry) => (
                            <Cell key={entry.status} fill={STATUS_COLOR[entry.status]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${formatInt(Number(value))} reservas`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="legend">
                    {statuses.map((entry) => (
                      <li key={entry.status}>
                        <span className="dot" style={{ background: STATUS_COLOR[entry.status] }} />
                        <span className="legend-name">{entry.label}</span>
                        <span className="muted">{formatInt(entry.count)} · {percent(entry.count, data.ordersInPeriod)}%</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="dash-grid">
                <section className="card chart-card">
                  <div className="chart-head">
                    <div>
                      <h2>Produtos mais vendidos</h2>
                      <p className="muted card-subtitle">Na plataforma toda, os 8 primeiros do período.</p>
                    </div>
                    <div className="segmented" role="group" aria-label="Métrica dos produtos">
                      <button className={productMetric === 'units' ? 'active' : ''} onClick={() => setProductMetric('units')} aria-pressed={productMetric === 'units'}>
                        Unidades
                      </button>
                      <button className={productMetric === 'revenue' ? 'active' : ''} onClick={() => setProductMetric('revenue')} aria-pressed={productMetric === 'revenue'}>
                        Receita
                      </button>
                    </div>
                  </div>
                  <div className="chart-box" style={{ height: Math.max(220, topProducts.length * 42 + 20) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" allowDecimals={false} tickFormatter={productMetric === 'revenue' ? (v: number) => formatCents(v) : undefined} />
                        <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 13 }} />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          formatter={(value) => (productMetric === 'revenue' ? formatCents(Number(value)) : `${formatInt(Number(value))} un.`)}
                          labelFormatter={(_, payload) => {
                            const item = payload?.[0]?.payload as { name?: string; partnerName?: string } | undefined;
                            return item ? `${item.name} · ${item.partnerName}` : '';
                          }}
                        />
                        <Bar dataKey={productMetric === 'units' ? 'units' : 'revenueCents'} name={productMetric === 'units' ? 'Vendidos' : 'Receita'} fill={productMetric === 'units' ? NAVY : ORANGE} radius={[0, 8, 8, 0]} />
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
                        <span className="muted">{formatInt(entry.units)} un. · {percent(entry.units, totalUnits)}%</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          )}

          {data.pendingPartners.length > 0 ? (
            <section className="card" style={{ marginBottom: 24 }}>
              <div className="chart-head">
                <h2>Empresas aguardando aprovação</h2>
                <Link className="btn btn-primary btn-sm" to="/empresas">
                  Revisar cadastros
                </Link>
              </div>
              <p className="muted card-subtitle">
                {formatInt(data.pendingPartners.length)} cadastro(s) pendente(s), do mais antigo para o mais novo.
              </p>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Categoria</th>
                      <th>Cadastrada em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pendingPartners.slice(0, 20).map((partner) => (
                      <tr key={partner.id}>
                        <td className="strong">{partner.trade_name}</td>
                        <td>{partner.category ?? '—'}</td>
                        <td>{new Date(partner.created_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {hasSales ? (
            <section className="card" style={{ marginBottom: 24 }}>
              <h2>Ranking de empresas</h2>
              <p className="muted card-subtitle">Empresas com venda no período{data.byPartner.length > 20 ? ' (as 20 primeiras)' : ''}.</p>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Empresa</th>
                      <th className="num">Pedidos</th>
                      <th className="num">Unidades</th>
                      <th className="num">Vendas</th>
                      <th className="num">% do volume</th>
                      <th className="num">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byPartner.slice(0, 20).map((item, index) => (
                      <tr key={item.partnerId}>
                        <td>{index + 1}</td>
                        <td className="strong">{item.name}</td>
                        <td className="num">{formatInt(item.orders)}</td>
                        <td className="num">{formatInt(item.units)}</td>
                        <td className="num">{formatCents(item.revenueCents)}</td>
                        <td className="num">{percent(item.revenueCents, totalPartnerRevenue)}%</td>
                        <td className="num">{formatCents(item.commissionCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <p className="hint-block">
            Conta como venda o pedido já retirado ou entregue. “Volume vendido” é o dinheiro das lojas; “Receita da plataforma” é a comissão
            do FireStock, gravada em cada venda com a taxa do momento. “Itens salvos” são as unidades vendidas: o cadastro de produtos não guarda peso, então não há “kg salvos”.
            “Usuário ativo” é quem fez pelo menos uma reserva no período.
          </p>
        </>
      )}
    </>
  );
}
