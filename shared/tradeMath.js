// Shared trade math + Indian (NSE/BSE) charge model.
// Used by BOTH the server and the web client so numbers always agree.

const IN = {
  EQUITY_INTRADAY: {
    label: 'Equity Intraday',
    stt: 0.00025, sttSide: 'sell',
    exchange: 0.0000297,
    sebi: 0.000001,
    stamp: 0.00003, stampSide: 'buy',
    gst: 0.18
  },
  EQUITY_DELIVERY: {
    label: 'Equity Delivery',
    stt: 0.001, sttSide: 'both',
    exchange: 0.0000297,
    sebi: 0.000001,
    stamp: 0.00015, stampSide: 'buy',
    gst: 0.18
  },
  FUT: {
    label: 'Futures',
    stt: 0.000125, sttSide: 'sell',
    exchange: 0.000019,
    sebi: 0.000001,
    stamp: 0.00002, stampSide: 'buy',
    gst: 0.18
  },
  OPT: {
    label: 'Options',
    stt: 0.000625, sttSide: 'sell',
    exchange: 0.000503,
    sebi: 0.000001,
    stamp: 0.00003, stampSide: 'buy',
    gst: 0.18
  },
  COMMODITY: {
    label: 'Commodity',
    stt: 0.0001, sttSide: 'sell',
    exchange: 0.0000026,
    sebi: 0.000001,
    stamp: 0.00003, stampSide: 'buy',
    gst: 0.18
  }
};

export const INSTRUMENTS = {
  EQUITY_INTRADAY: IN.EQUITY_INTRADAY,
  EQUITY_DELIVERY: IN.EQUITY_DELIVERY,
  FUT: IN.FUT,
  OPT: IN.OPT,
  COMMODITY: IN.COMMODITY
};

export const DEFAULT_BROKERAGE = {
  flatPerOrder: 20,      // Rs 20 per executed order
  pct: 0.0003,           // or 0.03%, whichever is LOWER
  autoCharges: true,     // auto-calculate on save
  gstOnBrokerage: true
};

const num = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * Compute Indian-market round-trip charges for a trade.
 * trade: { instrument, qty, priceEntry, priceExit, multiplier }
 */
export function computeCharges(trade, brokerage = DEFAULT_BROKERAGE) {
  const preset = INSTRUMENTS[trade.instrument] || IN.EQUITY_INTRADAY;
  const qty = num(trade.qty);
  const mult = num(trade.multiplier, 1) || 1;
  const entry = num(trade.priceEntry);
  const exit = num(trade.priceExit);

  const buyTurnover = qty * mult * entry;
  const sellTurnover = qty * mult * exit;
  const turnover = buyTurnover + sellTurnover;

  // Brokerage: per executed order, lower of flat or pct
  const brokerOne = (t) => Math.min(num(brokerage.flatPerOrder), t * num(brokerage.pct));
  const brokerageTotal = turnover > 0 ? brokerOne(buyTurnover) + brokerOne(sellTurnover) : 0;

  const sttBase =
    preset.sttSide === 'both' ? turnover : preset.sttSide === 'buy' ? buyTurnover : sellTurnover;
  const stt = sttBase * preset.stt;

  const exchangeTxn = turnover * preset.exchange;
  const sebi = turnover * preset.sebi;
  const stamp = (preset.stampSide === 'buy' ? buyTurnover : sellTurnover) * preset.stamp;
  const gst = (brokerage.gstOnBrokerage ? 1 : 0) * (brokerageTotal + exchangeTxn + sebi) * preset.gst;

  const parts = {
    brokerage: r2(brokerageTotal),
    stt: r2(stt),
    exchangeTxn: r2(exchangeTxn),
    sebi: r2(sebi),
    stamp: r2(stamp),
    gst: r2(gst)
  };
  const total = r2(Object.values(parts).reduce((a, b) => a + b, 0));
  return { ...parts, total, turnover: r2(turnover) };
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Derive gross/net P&L, R-multiple, holding time for a trade row.
 */
export function deriveTrade(trade, brokerage = DEFAULT_BROKERAGE) {
  const qty = num(trade.qty);
  const mult = num(trade.multiplier, 1) || 1;
  const entry = num(trade.priceEntry);
  const exit = num(trade.priceExit);
  const short = String(trade.direction || '').toUpperCase() === 'SHORT';
  const closed = trade.status === 'CLOSED' && exit > 0;

  const gross = closed ? (short ? (entry - exit) : (exit - entry)) * qty * mult : 0;
  const charges = closed
    ? (trade.charges != null && trade.charges !== '' ? num(trade.charges) : computeCharges(trade, brokerage).total)
    : 0;
  const net = r2(gross - charges);

  // Risk / R-multiple
  let riskAmount = null;
  let rMultiple = null;
  const sl = num(trade.stopLoss);
  if (sl > 0 && entry > 0) {
    riskAmount = r2(Math.abs(entry - sl) * qty * mult);
    if (riskAmount > 0 && closed) rMultiple = r2(net / riskAmount);
  }
  if (closed && trade.riskAmountOverride) {
    riskAmount = num(trade.riskAmountOverride);
    if (riskAmount > 0) rMultiple = r2(net / riskAmount);
  }

  // Holding time
  let holdingMinutes = null;
  if (closed && trade.entryDate && trade.exitDate) {
    const ms = new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime();
    if (Number.isFinite(ms) && ms >= 0) holdingMinutes = Math.round(ms / 60000);
  }

  const outcome = !closed ? 'OPEN' : net > 0 ? 'WIN' : net < 0 ? 'LOSS' : 'BE';

  return {
    grossPnl: r2(gross),
    charges: r2(charges),
    netPnl: net,
    riskAmount,
    rMultiple,
    holdingMinutes,
    outcome,
    closed
  };
}

/** Apply derived fields onto a row (used before persisting). */
export function withDerived(trade, brokerage = DEFAULT_BROKERAGE) {
  const d = deriveTrade(trade, brokerage);
  return {
    ...trade,
    grossPnl: d.grossPnl,
    charges: d.charges,
    netPnl: d.netPnl,
    riskAmount: d.riskAmount,
    rMultiple: d.rMultiple,
    holdingMinutes: d.holdingMinutes,
    outcome: d.outcome
  };
}

export const fmtMoney = (n, currency = '₹') => {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  return `${sign}${currency}${Math.abs(v).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const fmtCompact = (n, currency = '₹') => {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e7) return `${sign}${currency}${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${sign}${currency}${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${sign}${currency}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${currency}${a.toFixed(0)}`;
};
