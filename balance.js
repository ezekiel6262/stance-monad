(function () {
  let lastWallet = '';

  async function refresh() {
    const target = document.getElementById('ausd-live-balance');
    if (!target) return;
    const wallet = window.StanceWallet?.getAccount?.();
    if (!wallet) {
      target.textContent = 'Connect wallet';
      lastWallet = '';
      return;
    }
    if (wallet === lastWallet && target.dataset.loaded === 'true') return;
    lastWallet = wallet;
    target.textContent = 'Loading…';
    try {
      const response = await fetch(`/api/ausd?wallet=${encodeURIComponent(wallet)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'AUSD balance unavailable');
      target.textContent = `${data.balance} AUSD`;
      target.dataset.loaded = 'true';
      target.title = `${wallet} · ${data.token.address}`;
    } catch (error) {
      target.textContent = 'Unavailable';
      target.title = error.message;
      target.dataset.loaded = 'false';
    }
  }

  window.StanceAUSD = Object.freeze({ refresh });
  setInterval(refresh, 2000);
  refresh();
})();
