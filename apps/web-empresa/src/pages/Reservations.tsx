import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { formatCents } from '../lib/money';
import {
  deadlineText,
  FULFILLMENT_LABEL,
  isCompletePickupCode,
  nextAction,
  normalizePickupCode,
  paymentInstruction,
  stageFlow,
  stageIndex,
  stageLabel,
  statusLabel,
} from '../lib/pickup-rules';
import { usePartner } from '../partner/PartnerContext';
import {
  advanceReservation,
  cancelReservation,
  confirmPickup,
  listOpenReservations,
  listRecentClosed,
  type Reservation,
} from '../reservations/api';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const itemsText = (reservation: Reservation) =>
  reservation.items.map((item) => `${item.quantity}× ${item.product_name}`).join(', ') || 'Sem itens';

/** Tipo do pedido, endereço (delivery) e o que fazer com o pagamento. */
function OrderInfo({ reservation }: { reservation: Reservation }) {
  const payment = paymentInstruction(
    reservation.payment_method,
    reservation.fulfillment,
    reservation.amount_due_cents ?? reservation.total_cents,
    formatCents,
  );
  return (
    <>
      <div className="order-tags">
        <span className={`badge ${reservation.fulfillment === 'delivery' ? 'badge-delivery' : 'badge-pickup'}`}>
          {FULFILLMENT_LABEL[reservation.fulfillment]}
        </span>
        {payment ? <span className={payment.collect ? 'payment-collect' : 'product-meta'}>{payment.text}</span> : null}
      </div>
      {reservation.fulfillment === 'delivery' && reservation.delivery_address ? (
        <div className="product-meta">Entregar em: {reservation.delivery_address}</div>
      ) : null}
    </>
  );
}

const STATUS_BADGE: Record<string, string> = { picked_up: 'badge-active', cancelled: 'badge-expired', expired: 'badge-expired', no_show: 'badge-expired' };

// Com a tela aberta, busca de novo a cada 30 s para novas reservas do app aparecerem sem recarregar.
const POLL_INTERVAL_MS = 30_000;

export function Reservations() {
  const { partner } = usePartner();
  const toast = useToast();
  const partnerId = partner?.id;
  const [open, setOpen] = useState<Reservation[]>([]);
  const [closed, setClosed] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [toCancel, setToCancel] = useState<Reservation | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!partnerId) return;
    try {
      const [openList, closedList] = await Promise.all([listOpenReservations(partnerId), listRecentClosed(partnerId)]);
      setOpen(openList);
      setClosed(closedList);
      setNow(new Date());
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as reservas.');
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const confirm = async (target: { id: string } | { code: string }, label: string) => {
    await confirmPickup(target);
    // O tipo do pedido vem da lista em aberto (pelo id ou pelo código digitado).
    const confirmed = open.find((item) => ('id' in target ? item.id === target.id : item.pickup_code === normalizePickupCode(target.code)));
    const what = confirmed?.fulfillment === 'delivery' ? 'Entrega' : 'Retirada';
    toast.success(`${what} do pedido ${label} confirmada. A venda já conta no painel.`);
    await load();
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!isCompletePickupCode(code)) {
      setCodeError('Digite os 6 números do código que o cliente mostra no app.');
      return;
    }
    setSubmittingCode(true);
    setCodeError('');
    try {
      await confirm({ code }, `FS-${normalizePickupCode(code)}`);
      setCode('');
    } catch (confirmError) {
      setCodeError(confirmError instanceof Error ? confirmError.message : 'Não foi possível confirmar a retirada.');
    } finally {
      setSubmittingCode(false);
    }
  };

  /** Botão principal do pedido: próxima etapa (o cliente vê no app) ou, na última, confirmar retirada/entrega. */
  const runNextAction = async (reservation: Reservation) => {
    const action = nextAction(reservation.fulfillment, reservation.stage);
    setBusyId(reservation.id);
    try {
      if (action.kind === 'complete') {
        await confirm({ id: reservation.id }, `FS-${reservation.pickup_code}`);
      } else {
        await advanceReservation(reservation.id, action.stage);
        toast.success(`Pedido FS-${reservation.pickup_code}: "${stageLabel(reservation.fulfillment, action.stage)}". O cliente já vê no app.`);
        await load();
      }
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Não foi possível atualizar o pedido.');
    } finally {
      setBusyId(null);
    }
  };

  const cancelSelected = async () => {
    if (!toCancel) return;
    setBusyId(toCancel.id);
    try {
      await cancelReservation(toCancel.id);
      toast.success(`Pedido FS-${toCancel.pickup_code} cancelado. O estoque voltou para os produtos.`);
      await load();
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : 'Não foi possível cancelar a reserva.');
    } finally {
      setBusyId(null);
      setToCancel(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pedidos</h1>
          <p className="muted">
            Pedidos feitos no app, para retirar na loja ou para entregar. Confirme quando o cliente retirar ou quando a entrega for feita: só
            então o pedido conta como venda no painel.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>
          Atualizar
        </button>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <form className="card pickup-code-card" onSubmit={submitCode} noValidate>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="pickup-code">Código do pedido</label>
          <div className="pickup-code-row">
            <input
              id="pickup-code"
              inputMode="numeric"
              autoComplete="off"
              placeholder="FS-000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError('');
              }}
              aria-invalid={codeError ? true : undefined}
              aria-describedby="pickup-code-hint"
            />
            <button className="btn btn-primary" type="submit" disabled={submittingCode}>
              {submittingCode ? 'Confirmando…' : 'Confirmar'}
            </button>
          </div>
          <span id="pickup-code-hint" className={codeError ? 'error' : 'hint'} role={codeError ? 'alert' : undefined}>
            {codeError || 'O cliente mostra o código na tela do pedido (ex.: FS-123456). Serve para retirada e para entrega.'}
          </span>
        </div>
      </form>

      <h2 className="section-heading">Em aberto {open.length > 0 ? `(${open.length})` : ''}</h2>
      {loading ? (
        <p className="muted">Carregando…</p>
      ) : open.length === 0 ? (
        <div className="card empty">
          <p className="muted">Nenhum pedido aguardando retirada ou entrega.</p>
        </div>
      ) : (
        <div className="product-list">
          {open.map((reservation) => {
            const deadline = deadlineText(reservation.pickup_deadline, now);
            const action = nextAction(reservation.fulfillment, reservation.stage);
            const flow = stageFlow(reservation.fulfillment);
            const current = stageIndex(reservation.stage);
            return (
              <div className="reservation-item" key={reservation.id}>
                <div>
                  <div className="product-name">
                    FS-{reservation.pickup_code} <span className="price" style={{ marginLeft: 8 }}>{formatCents(reservation.total_cents)}</span>
                  </div>
                  <ol className="stage-track" aria-label={`Etapa atual: ${stageLabel(reservation.fulfillment, reservation.stage)}`}>
                    {flow.map((label, index) => (
                      <li key={label} className={index < current ? 'done' : index === current ? 'current' : undefined}>
                        {label}
                      </li>
                    ))}
                  </ol>
                  <div className="product-meta">{itemsText(reservation)}</div>
                  <OrderInfo reservation={reservation} />
                  <div className="product-meta">
                    Pedido em {formatDateTime(reservation.created_at)}
                    {deadline ? (
                      <>
                        {' · '}
                        <span className={deadline.late ? 'deadline-late' : undefined}>{deadline.text}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="actions">
                  <button
                    className={action.kind === 'complete' ? 'btn btn-primary btn-sm' : 'btn btn-navy btn-sm'}
                    onClick={() => runNextAction(reservation)}
                    disabled={busyId === reservation.id}>
                    {busyId === reservation.id ? 'Aguarde…' : action.label}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setToCancel(reservation)} disabled={busyId === reservation.id}>
                    Cancelar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 ? (
        <>
          <h2 className="section-heading">Histórico recente</h2>
          <div className="product-list">
            {closed.map((reservation) => (
              <div className="reservation-item" key={reservation.id}>
                <div>
                  <div className="product-name">
                    FS-{reservation.pickup_code} <span className="price" style={{ marginLeft: 8 }}>{formatCents(reservation.total_cents)}</span>
                  </div>
                  <div className="product-meta">{itemsText(reservation)}</div>
                  <OrderInfo reservation={reservation} />
                  <div className="product-meta">
                    {reservation.picked_up_at
                      ? `${reservation.fulfillment === 'delivery' ? 'Entregue' : 'Retirada'} em ${formatDateTime(reservation.picked_up_at)}`
                      : reservation.cancelled_at
                        ? `Cancelada em ${formatDateTime(reservation.cancelled_at)}`
                        : `Pedido em ${formatDateTime(reservation.created_at)}`}
                  </div>
                </div>
                <div className="actions">
                  <span className={`badge ${STATUS_BADGE[reservation.status] ?? 'badge-pending'}`}>{statusLabel(reservation.status, reservation.fulfillment)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {toCancel ? (
        <ConfirmDialog
          title="Cancelar pedido?"
          message={`O pedido FS-${toCancel.pickup_code} será cancelado e os produtos voltam para o estoque. O cliente vê o cancelamento no app.`}
          confirmLabel="Cancelar pedido"
          cancelLabel="Manter"
          busy={busyId === toCancel.id}
          onConfirm={cancelSelected}
          onCancel={() => setToCancel(null)}
        />
      ) : null}
    </>
  );
}
