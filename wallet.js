const MONAD = {
  chainId: '0x8f',
  chainName: 'Monad Mainnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: ['https://rpc.monad.xyz'],
  blockExplorerUrls: ['https://monadscan.com']
};

let account = null;
const button = document.getElementById('connect-wallet');

async function switchToMonad(provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: MONAD.chainId }] });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [MONAD] });
  }
}

async function connect() {
  const provider = window.ethereum;
  if (!provider) {
    button.textContent = 'Privy activation pending';
    button.title = 'Embedded wallet onboarding becomes available when NEXT_PUBLIC_PRIVY_APP_ID is configured.';
    return null;
  }
  const [address] = await provider.request({ method: 'eth_requestAccounts' });
  await switchToMonad(provider);
  account = address;
  button.textContent = `${address.slice(0, 6)}…${address.slice(-4)}`;
  button.title = 'Connected to Monad mainnet';
  return address;
}

async function send(transaction) {
  if (!account) await connect();
  if (!account) throw new Error('Wallet not connected');
  await switchToMonad(window.ethereum);
  return window.ethereum.request({ method: 'eth_sendTransaction', params: [{ ...transaction, from: account }] });
}

button?.addEventListener('click', () => connect().catch(error => {
  button.textContent = 'Connection failed';
  button.title = error.message;
}));

window.StanceWallet = { connect, send, getAccount: () => account, chainId: 143 };
