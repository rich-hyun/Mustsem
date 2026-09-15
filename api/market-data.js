// api/market-data.js — Vercel 서버리스 함수 (저장소 루트의 api/ 폴더에 두면 /api/market-data 로 자동 배포됨)
// GET /api/market-data?from=2026-01-01&to=2026-09-10
//
// dashboard.html 의 "가치 변화" 차트가 쓰는 실제 과거 시세를 내려줍니다.
//   QQQ : Stooq (무료 CSV)  →  실패 시 Yahoo Finance chart API
//   BTC : CoinGecko 공개 API →  실패 시 Yahoo Finance (BTC-USD)
// 결과는 Vercel CDN 에 30분 캐시되므로 방문자가 많아도 원본 API 호출은 하루 수십 회 수준입니다.
//
// 응답: { updated, range, data: { btc: [{date, close}], qqq: [...] }, sources: { btc, qqq }, errors: {...} }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UA = "Mozilla/5.0 (compatible; MustsemDashboard/1.0; +https://www.mustsem.co.kr)";

const todayKey = () => new Date().toISOString().slice(0, 10);
const unix = (key) => Math.floor(Date.parse(`${key}T00:00:00Z`) / 1000);
const inRange = (rows, from, to) => rows.filter((r) => r.date >= from && r.date <= to);
const sortRows = (rows) => rows.sort((a, b) => (a.date < b.date ? -1 : 1));

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/* ---------- Yahoo Finance (주식·코인 공통 폴백) ---------- */
async function fromYahoo(symbol, from, to) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${unix(from)}&period2=${unix(to) + 86400}&interval=1d&events=history`;
  const json = JSON.parse(await getText(url));
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  if (!r || !Array.isArray(r.timestamp)) throw new Error("Yahoo 응답 형식 오류");
  const closes = r.indicators.quote[0].close;
  const rows = [];
  r.timestamp.forEach((t, i) => {
    const c = closes[i];
    if (Number.isFinite(c) && c > 0) rows.push({ date: new Date(t * 1000).toISOString().slice(0, 10), close: c });
  });
  return inRange(sortRows(rows), from, to);
}

/* ---------- QQQ: Stooq 일별 CSV ---------- */
async function qqqFromStooq(from, to) {
  const csv = await getText("https://stooq.com/q/d/l/?s=qqq.us&i=d");
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !/^Date,Open/i.test(lines[0])) throw new Error("Stooq CSV 형식 오류");
  const rows = [];
  for (const line of lines.slice(1)) {
    const [date, , , , close] = line.split(",");
    const c = Number(close);
    if (DATE_RE.test(date) && Number.isFinite(c) && c > 0) rows.push({ date, close: c });
  }
  return inRange(sortRows(rows), from, to);
}

/* ---------- BTC: CoinGecko ---------- */
async function btcFromCoinGecko(from, to) {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${unix(from)}&to=${unix(to) + 86400}`;
  const json = JSON.parse(await getText(url));
  if (!json || !Array.isArray(json.prices)) throw new Error("CoinGecko 응답 형식 오류");
  const byDay = new Map();
  json.prices.forEach(([ms, price]) => byDay.set(new Date(ms).toISOString().slice(0, 10), price));
  const rows = Array.from(byDay, ([date, close]) => ({ date, close }));
  return inRange(sortRows(rows), from, to);
}

async function firstOk(attempts, errors, key) {
  for (const [name, fn] of attempts) {
    try {
      const rows = await fn();
      if (rows.length > 1) return { rows, source: name };
      errors[`${key}:${name}`] = "데이터 없음";
    } catch (err) {
      errors[`${key}:${name}`] = String(err && err.message || err);
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  const q = req.query || {};
  const from = DATE_RE.test(q.from) ? q.from : "2026-01-01";
  const to = DATE_RE.test(q.to) && q.to <= todayKey() ? q.to : todayKey();

  const errors = {};
  const [qqq, btc] = await Promise.all([
    firstOk([["Stooq", () => qqqFromStooq(from, to)], ["Yahoo Finance", () => fromYahoo("QQQ", from, to)]], errors, "qqq"),
    firstOk([["CoinGecko", () => btcFromCoinGecko(from, to)], ["Yahoo Finance", () => fromYahoo("BTC-USD", from, to)]], errors, "btc"),
  ]);

  const data = {}, sources = {};
  if (qqq) { data.qqq = qqq.rows; sources.qqq = qqq.source; }
  if (btc) { data.btc = btc.rows; sources.btc = btc.source; }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // 정상일 때만 CDN 캐시(30분) — 실패 응답은 캐시하지 않음
  res.setHeader("Cache-Control", Object.keys(data).length === 2
    ? "public, s-maxage=1800, stale-while-revalidate=86400"
    : "no-store");
  res.status(Object.keys(data).length ? 200 : 502).json({
    updated: new Date().toISOString(),
    range: { from, to },
    data,
    sources,
    errors,
  });
};