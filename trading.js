(function () {
  const post = async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.detail || payload.error || 'Request failed');
    return payload;
  };

  const account = async () => {
    if (!window.StanceWallet) throw new Error('Wallet is still loading');
    return window.StanceWallet.getAccount() || window.StanceWallet.connect();
  };

  const preview = async ({ tokenIn, tokenOut, amountRaw, slippageBps = 50 }) => {
    const wallet = await account();
    const quote = await post('/api/kuru-quote', { wallet, tokenIn, tokenOut, amountRaw, slippageBps });
    const plan = await post('/api/kuru-transaction', { wallet, tokenIn, amountRaw, swap: quote.transaction });
    return { ...plan, quote, wallet };
  };

  const execute = async plan => {
    const status = await fetch('/api/integrations', { cache: 'no-store' }).then(response => response.json());
    if (!status.realMoneyEnabled) throw new Error('Real-money execution is safety-locked');
    if (!plan?.transactions?.length || plan.transactions.length > 2) throw new Error('Invalid transaction plan');
    const wallet = await account();
    if (wallet.toLowerCase() !== String(plan.wallet).toLowerCase()) throw new Error('Wallet changed after quote');
    const receipts = [];
    for (const transaction of plan.transactions) {
      if (transaction.chainId !== 143 || String(transaction.from).toLowerCase() !== wallet.toLowerCase()) {
        throw new Error('Transaction plan failed wallet or network validation');
      }
      const hash = await window.StanceWallet.send({
        to: transaction.to, data: transaction.data, value: `0x${BigInt(transaction.value || '0').toString(16)}`,
        ...(transaction.gas ? { gas: `0x${BigInt(transaction.gas).toString(16)}` } : {})
      });
      receipts.push(await window.StanceWallet.waitForReceipt(hash));
    }
    return receipts;
  };

  window.StanceTrading = Object.freeze({ preview, execute });
})();
