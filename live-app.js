(function () {
  const O = '#ff8a3d';
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const short = value => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';
  const money = value => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} AUSD`;
  const date = seconds => seconds ? new Date(seconds * 1000).toLocaleString() : '—';
  const explorer = (kind, value) => `https://monadscan.com/${kind}/${value}`;
  const outcome = ['Open', 'Back won', 'Fade won', 'Cancelled'];
  let route = location.hash.replace('#/', '') || 'feed';
  let state = { loading: true, error: '', data: null, wallet: null, refreshedAt: null };

  const nav = [
    ['feed', 'Markets'], ['proof', 'Proof Stances'], ['trails', 'Trail Portfolio'],
    ['receipts', 'My Receipts'], ['alerts', 'Alerts'], ['wallet', 'Wallet'], ['integrations', 'Integrations']
  ];

  function layout(content) {
    return `<div class="live-shell"><aside><a class="brand" href="#/feed"><span>◒</span> stance</a>${nav.map(([key, label]) => `<button class="nav ${route === key ? 'on' : ''}" data-route="${key}">${label}</button>`).join('')}<button class="create" data-route="proof">Publish proof</button></aside><main><header><div><span class="live-dot"></span> LIVE ON MONAD <span class="muted">block ${state.data?.latestBlock?.toLocaleString() || '—'}</span></div><div id="connect-wallet-root"><button id="connect-wallet">Connect wallet</button></div></header>${state.error ? `<div class="error">${esc(state.error)}</div>` : ''}${content}</main></div>`;
  }

  const empty = (title, body, action = '') => `<div class="empty"><h2>${title}</h2><p>${body}</p>${action}</div>`;
  const transaction = event => `<a class="row" href="${explorer('tx', event.transactionHash)}" target="_blank" rel="noreferrer"><div><b>${esc(event.kind || 'Monad transaction')}</b><p>${esc(event.detail || `Block ${event.blockNumber}`)}</p></div><span>${short(event.transactionHash)} ↗</span></a>`;

  function feed() {
    const markets = state.data?.markets || [];
    return `<div class="title"><div><p class="eyebrow">ONCHAIN MARKETS</p><h1>Stances backed by receipts.</h1><p>Nothing on this page is seeded. Pools and outcomes are read from StanceMarket on Monad.</p></div><button class="secondary" id="refresh">Refresh</button></div>${markets.length ? `<div class="grid">${markets.map(m => `<article><div class="tags"><span>MARKET ${m.marketId}</span><span>${outcome[m.outcome]}</span></div><h2>Thesis commitment ${short(m.thesisHash)}</h2><p class="mono">${esc(m.thesisHash)}</p><div class="split"><div><label>Back pool</label><b>${money(m.backPool)}</b></div><div><label>Fade pool</label><b>${money(m.fadePool)}</b></div></div><p>Closes ${date(m.closesAt)}</p></article>`).join('')}</div>` : empty('No markets have been created yet.', 'The deployed StanceMarket contract is live, but its current market count is zero. The first real market will appear here as soon as it is created onchain.', '<a class="primary" href="#/integrations">View contract</a>')}`;
  }

  function proofs() {
    const proofs = state.data?.proofs || [];
    return `<div class="title"><div><p class="eyebrow">PROOF STANCES</p><h1>Thesis plus onchain proof.</h1><p>Published directly from the StancePortfolio contract. Evidence links and position sizes come from emitted receipts.</p></div></div>${proofs.length ? proofs.map(p => `<article><div class="tags"><span>PROOF</span><span>${short(p.author)}</span></div><h2>Stance ${short(p.stanceId)}</h2><p>Thesis commitment <span class="mono">${short(p.thesisHash)}</span></p><div class="split"><div><label>Position</label><b>${money(p.positionSize)}</b></div><div><label>Expires</label><b>${date(Number(p.expiresAt))}</b></div></div><a href="${esc(p.evidenceURI)}" target="_blank" rel="noreferrer">Open evidence ↗</a></article>`).join('') : empty('No proof stances found.', 'No ProofStancePublished events were found in the indexed Monad block range. Connect the author wallet to filter your own receipts.')}`;
  }

  function trails() {
    const tails = state.data?.tails || [];
    return `<div class="title"><div><p class="eyebrow">TRAIL PORTFOLIO</p><h1>Follow a stance with attribution.</h1><p>Trail relationships are permanent Monad events—not local “fork” counters.</p></div></div>${tails.length ? tails.map(t => `<article><div class="tags"><span>TRAIL</span><span>${short(t.follower)}</span></div><h2>Trailing ${short(t.caller)}</h2><p>Stance ${short(t.stanceId)}</p><b>${money(t.amount)}</b><br><a href="${explorer('tx', t.transactionHash)}" target="_blank" rel="noreferrer">Receipt ↗</a></article>`).join('') : empty('No trail relationships yet.', 'When a wallet trails a published stance, the TailRecorded receipt will appear here.')}`;
  }

  function receipts() {
    if (!state.wallet) return empty('Connect your wallet.', 'Receipts are wallet-specific. Sign in with Privy or your Mera passkey to load your real positions, proofs, trails, and claims.');
    const events = [
      ...(state.data?.positions || []).map(x => ({ ...x, kind: x.back ? 'Back position' : 'Fade position', detail: `${money(x.amount)} · Market ${x.marketId}` })),
      ...(state.data?.proofs || []).map(x => ({ ...x, kind: 'Proof stance', detail: `Stance ${short(x.stanceId)}` })),
      ...(state.data?.tails || []).map(x => ({ ...x, kind: 'Trail recorded', detail: `${money(x.amount)} · ${short(x.caller)}` })),
      ...(state.data?.claims || []).map(x => ({ ...x, kind: 'Payout claimed', detail: `${money(x.amount)} · Market ${x.marketId}` }))
    ].sort((a, b) => b.blockNumber - a.blockNumber);
    return `<div class="title"><div><p class="eyebrow">MY RECEIPTS</p><h1>${short(state.wallet)}</h1><p>Verified activity read from Monad for this connected wallet.</p></div></div>${events.length ? `<div class="list">${events.map(transaction).join('')}</div>` : empty('No receipts for this wallet.', 'This wallet has no positions, proofs, trails, or claims in the indexed range.')}`;
  }

  function alerts() {
    if (!state.wallet) return empty('Connect your wallet to load alerts.', 'Alerts are derived from real resolution and claim events connected to your positions.');
    const events = state.data?.resolutions || [];
    return `<div class="title"><div><p class="eyebrow">ALERTS</p><h1>Onchain changes only.</h1><p>No fabricated exits, resolutions, or yield messages.</p></div></div>${events.length ? `<div class="list">${events.map(x => transaction({ ...x, kind: `Market ${x.marketId} resolved`, detail: outcome[Number(x.outcome)] })).join('')}</div>` : empty('You are all caught up.', 'No market-resolution events were found in the current live range.')}`;
  }

  function wallet() {
    return `<div class="title"><div><p class="eyebrow">WALLET</p><h1>${state.wallet ? short(state.wallet) : 'Not connected'}</h1><p>Balances are loaded from Monad. Simulated deposits, withdrawals, yield, and linked wallets have been removed.</p></div></div><div class="grid"><article><label>Agora AUSD · Monad</label><h2 id="ausd-live-balance">${state.wallet ? 'Loading…' : 'Connect wallet'}</h2><p>Live ERC-20 balance</p></article><article><label>Network</label><h2>Monad Mainnet</h2><p>Chain ID 143</p></article></div>`;
  }

  function integrations() {
    const c = state.data?.contracts || {};
    return `<div class="title"><div><p class="eyebrow">LIVE INFRASTRUCTURE</p><h1>What is actually connected.</h1><p>Contract addresses and service health—not bounty logos presented as finished integrations.</p></div></div><div class="list"><a class="row" href="${explorer('address', c.market)}" target="_blank"><div><b>StanceMarket</b><p>Markets, Back/Fade pools, resolution and claims</p></div><span>${short(c.market)} ↗</span></a><a class="row" href="${explorer('address', c.portfolio)}" target="_blank"><div><b>StancePortfolio</b><p>Proof Stances and Trail relationships</p></div><span>${short(c.portfolio)} ↗</span></a><div class="row"><div><b>Envio HyperSync</b><p>Event indexing endpoint configured</p></div><span>CONNECTED</span></div><div class="row"><div><b>Kuru</b><p>Quote and transaction-plan endpoints wired; execution remains safety-locked</p></div><span>LOCKED</span></div><div class="row"><div><b>Privy + Mera</b><p>Production authentication and role-separated passkey wallets</p></div><span>LIVE</span></div></div>`;
  }

  function render() {
    const root = document.getElementById('stance-live-root');
    if (!root) return;
    if (state.loading && !state.data) root.innerHTML = layout(empty('Reading Monad…', 'Loading deployed contracts and indexed events.'));
    else {
      const pages = { feed, proof: proofs, trails, receipts, alerts, wallet, integrations };
      root.innerHTML = layout((pages[route] || feed)());
    }
    root.querySelectorAll('[data-route]').forEach(el => el.onclick = () => { location.hash = `#/${el.dataset.route}`; });
    document.getElementById('refresh')?.addEventListener('click', refresh);
    window.StanceAUSD?.refresh?.();
  }

  async function refresh() {
    state.wallet = window.StanceWallet?.getAccount?.() || null;
    state.loading = true; render();
    try {
      const query = state.wallet ? `?wallet=${encodeURIComponent(state.wallet)}` : '';
      const response = await fetch(`/api/live-state${query}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || 'Live state unavailable');
      state = { ...state, loading: false, error: '', data, refreshedAt: Date.now() };
    } catch (error) { state = { ...state, loading: false, error: `Live data unavailable: ${error.message}` }; }
    render();
  }

  function start() {
    document.body.innerHTML = '<div id="stance-live-root"></div>';
    window.addEventListener('hashchange', () => { route = location.hash.replace('#/', '') || 'feed'; render(); });
    refresh();
    setInterval(() => {
      const wallet = window.StanceWallet?.getAccount?.() || null;
      if (wallet !== state.wallet) refresh();
    }, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
