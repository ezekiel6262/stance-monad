import React, { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider, useConnectOrCreateWallet, usePrivy, useWallets } from '@privy-io/react-auth';

const MONAD = {
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Monad Explorer', url: 'https://monadscan.com' } }
};

const buttonStyle = {
  border: '1px solid #FF8A3D', borderRadius: 999, padding: '5px 11px',
  background: 'transparent', color: '#FF8A3D', font: 'inherit', cursor: 'pointer'
};

const short = address => `${address.slice(0, 6)}…${address.slice(-4)}`;

function PrivyWalletButton() {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const walletRef = useRef(null);
  const wallet = useMemo(() => wallets.find(item => item.chainType === 'ethereum') || null, [wallets]);
  const { connectOrCreateWallet } = useConnectOrCreateWallet({
    onSuccess: async ({ wallet: connected }) => {
      walletRef.current = connected;
      await connected.switchChain(MONAD.id);
    }
  });

  useEffect(() => {
    walletRef.current = wallet;
    if (wallet) wallet.switchChain(MONAD.id).catch(() => {});
  }, [wallet]);

  useEffect(() => {
    window.StanceWallet = {
      chainId: MONAD.id,
      getAccount: () => walletRef.current?.address || null,
      connect: async () => {
        if (!walletRef.current) await connectOrCreateWallet();
        return walletRef.current?.address || null;
      },
      send: async transaction => {
        const active = walletRef.current;
        if (!active) throw new Error('Connect a wallet before continuing');
        await active.switchChain(MONAD.id);
        const provider = await active.getEthereumProvider();
        return provider.request({
          method: 'eth_sendTransaction',
          params: [{ ...transaction, from: active.address }]
        });
      },
      logout
    };
  }, [connectOrCreateWallet, logout, wallet]);

  const disabled = false;
  const label = wallet ? short(wallet.address) : authenticated ? 'Create wallet' : 'Sign in / Connect';
  return React.createElement('button', {
    id: 'connect-wallet', style: buttonStyle, disabled,
    title: wallet ? 'Privy wallet connected on Monad' : 'Sign in with email, passkey, or an external wallet',
    onClick: () => connectOrCreateWallet().catch(error => console.error('Privy wallet connection failed', error))
  }, label);
}

function injectedFallback() {
  const button = document.getElementById('connect-wallet');
  let account = null;
  const switchToMonad = async provider => {
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x8f' }] });
    } catch (error) {
      if (error?.code !== 4902) throw error;
      await provider.request({ method: 'wallet_addEthereumChain', params: [{
        chainId: '0x8f', chainName: 'Monad Mainnet', nativeCurrency: MONAD.nativeCurrency,
        rpcUrls: MONAD.rpcUrls.default.http, blockExplorerUrls: [MONAD.blockExplorers.default.url]
      }] });
    }
  };
  const connect = async () => {
    if (!window.ethereum) throw new Error('No wallet provider found');
    [account] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await switchToMonad(window.ethereum);
    button.textContent = short(account);
    return account;
  };
  window.StanceWallet = {
    chainId: MONAD.id, connect, getAccount: () => account,
    send: async transaction => {
      if (!account) await connect();
      await switchToMonad(window.ethereum);
      return window.ethereum.request({ method: 'eth_sendTransaction', params: [{ ...transaction, from: account }] });
    }
  };
  button?.addEventListener('click', () => connect().catch(error => { button.title = error.message; }));
}

async function start() {
  const root = document.getElementById('connect-wallet-root');
  if (!root) return;
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    if (!config.privyAppId) throw new Error('Privy App ID is not configured');
    createRoot(root).render(
      React.createElement(PrivyProvider, {
        appId: config.privyAppId,
        config: {
          appearance: { theme: 'dark', accentColor: '#FF8A3D' },
          // PassKeys remain enabled in the Privy dashboard. The connector modal
          // accepts email and external wallets as its explicit entry methods;
          // enrolled passkeys are surfaced by Privy during authentication.
          loginMethods: ['email', 'wallet'],
          embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } }
        }
      }, React.createElement(PrivyWalletButton))
    );
  } catch (error) {
    console.warn('Privy unavailable; using injected wallet fallback', error);
    injectedFallback();
  }
}

start();
