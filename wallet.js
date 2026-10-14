import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider, useConnectOrCreateWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  isMeraError
} from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

const MONAD = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Monad Explorer', url: 'https://monadscan.com' } }
});

const buttonStyle = {
  width: '100%', border: '1px solid #34343E', borderRadius: 9, padding: '8px 10px',
  background: '#0F0F14', color: '#F1EFE8', font: 'inherit', cursor: 'pointer'
};

const short = address => `${address.slice(0, 6)}…${address.slice(-4)}`;
const MERA_CREDENTIAL = 'stance.mera.credential';
const MERA_USER = 'stance.mera.user';
const MERA_ROLES = ['Trading', 'Proof', 'Trail'];

function announceWallet(address, provider, extra = {}) {
  if (!address) return;
  window.dispatchEvent(new CustomEvent('stance:wallet-connected', {
    detail: { address, provider, ...extra }
  }));
}

function announceDisconnect(provider) {
  window.dispatchEvent(new CustomEvent('stance:wallet-disconnected', { detail: { provider } }));
}

function deriveMeraKey(prfOutput, index) {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  seed.fill(0);
  if (!node.privateKey) throw new Error('Mera account derivation failed');
  return node.privateKey;
}

function meraMessage(error) {
  if (!isMeraError(error)) return error?.message || 'Mera passkey operation failed';
  if (error.code === 'PRF_UNAVAILABLE') return 'This passkey provider does not support secure Mera derivation.';
  if (error.code === 'CRYPTO_UNAVAILABLE') return 'Mera needs a secure HTTPS browser session.';
  if (error.code === 'PASSKEY_OPERATION_FAILED') return 'The passkey prompt was cancelled or failed.';
  return 'Mera passkey operation failed.';
}

function installMeraWallet(active, session, onLogout) {
  const walletClient = createWalletClient({ account: active.account, chain: MONAD, transport: http() });
  const publicClient = createPublicClient({ chain: MONAD, transport: http() });
  window.StanceWalletProvider = 'mera';
  window.StanceWallet = {
    chainId: MONAD.id,
    provider: 'mera',
    role: active.role,
    getAccount: () => active.account.address,
    connect: async () => active.account.address,
    send: async transaction => {
      const { from, chainId, ...request } = transaction;
      return walletClient.sendTransaction(request);
    },
    waitForReceipt: async (hash, timeoutMs = 120000) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: timeoutMs });
      if (receipt.status !== 'success') throw new Error('Transaction reverted on Monad');
      return receipt;
    },
    logout: async () => {
      session.end();
      window.StanceWallet = null;
      window.StanceWalletProvider = null;
      onLogout?.();
      announceDisconnect('mera');
    }
  };
  announceWallet(active.account.address, 'mera', { role: active.role });
}

function MeraWalletButton() {
  const [accounts, setAccounts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sessionRef = useRef(null);

  const activate = (nextAccounts, index, nextSession) => {
    sessionRef.current?.end();
    sessionRef.current = nextSession;
    setAccounts(nextAccounts);
    setActiveIndex(index);
    installMeraWallet(nextAccounts[index], nextSession, () => {
      sessionRef.current = null;
      setAccounts([]);
      setActiveIndex(0);
    });
  };

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const stored = localStorage.getItem(MERA_CREDENTIAL);
      const known = stored ? JSON.parse(stored) : null;
      const result = known
        ? await getPasskeyPrfOutput({ rpId: location.hostname, credential: known })
        : await createPasskeyWithPrfOutput({
            rp: { id: location.hostname, name: 'Stance on Monad' },
            user: {
              name: localStorage.getItem(MERA_USER) || `stance-${crypto.randomUUID()}`,
              displayName: 'Stance trader'
            }
          });

      const credential = { credentialId: result.credentialId, transports: result.transports };
      localStorage.setItem(MERA_CREDENTIAL, JSON.stringify(credential));
      if (!localStorage.getItem(MERA_USER)) localStorage.setItem(MERA_USER, `stance-${result.credentialId.slice(0, 8)}`);

      const derived = MERA_ROLES.map((role, index) => {
        const privateKey = deriveMeraKey(result.prfOutput, index);
        const tempSession = createSecp256k1SigningSession({ privateKey });
        privateKey.fill(0);
        const account = toViemAccount(tempSession);
        if (index !== 0) tempSession.end();
        return { role, address: account.address, account, session: index === 0 ? tempSession : null };
      });
      result.prfOutput.fill(0);
      activate(derived, 0, derived[0].session);
    } catch (cause) {
      setError(meraMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const switchRole = async event => {
    const index = Number(event.target.value);
    setBusy(true);
    setError('');
    try {
      const known = JSON.parse(localStorage.getItem(MERA_CREDENTIAL));
      const result = await getPasskeyPrfOutput({ rpId: location.hostname, credential: known });
      const privateKey = deriveMeraKey(result.prfOutput, index);
      result.prfOutput.fill(0);
      const nextSession = createSecp256k1SigningSession({ privateKey });
      privateKey.fill(0);
      const account = toViemAccount(nextSession);
      const nextAccounts = accounts.map((item, itemIndex) => itemIndex === index ? { ...item, account, address: account.address } : item);
      activate(nextAccounts, index, nextSession);
    } catch (cause) {
      setError(meraMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => () => sessionRef.current?.end(), []);

  return React.createElement('span', { style: { display: 'flex', width: '100%', gap: 6, alignItems: 'stretch', flexDirection: 'column' } },
    React.createElement('button', {
      id: 'mera-wallet',
      style: { ...buttonStyle, borderColor: '#8B7CFF', color: '#B9B0FF' },
      disabled: busy,
      title: error || 'One Mera passkey derives separate Trading, Proof, and Trail accounts on Monad',
      onClick: connect
    }, busy ? 'Passkey…' : accounts.length ? `Mera ${short(accounts[activeIndex].address)}` : 'Mera Passkey'),
    accounts.length ? React.createElement('select', {
      value: activeIndex,
      onChange: switchRole,
      disabled: busy,
      title: 'Choose the Monad account derived from this passkey',
        style: { width: '100%', background: '#111118', color: '#D6D4CC', border: '1px solid #34343E', borderRadius: 9, padding: '7px 8px', font: 'inherit' }
    }, accounts.map((item, index) => React.createElement('option', { key: item.role, value: index }, item.role))) : null
  );
}

function PrivyWalletButton() {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const walletRef = useRef(null);
  const wallet = useMemo(() => wallets.find(item => item.chainType === 'ethereum') || null, [wallets]);
  const { connectOrCreateWallet } = useConnectOrCreateWallet({
    onSuccess: async ({ wallet: connected }) => {
      walletRef.current = connected;
      await connected.switchChain(MONAD.id);
      window.StanceWalletProvider = 'privy';
      announceWallet(connected.address, 'privy');
    }
  });

  useEffect(() => {
    walletRef.current = wallet;
    if (wallet) {
      wallet.switchChain(MONAD.id).catch(() => {});
      announceWallet(wallet.address, 'privy');
    }
  }, [wallet]);

  useEffect(() => {
    if (window.StanceWalletProvider === 'mera') return;
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
      waitForReceipt: async (hash, timeoutMs = 120000) => {
        const active = walletRef.current;
        if (!active) throw new Error('Connect a wallet before continuing');
        const provider = await active.getEthereumProvider();
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
          if (receipt) {
            if (receipt.status === '0x0') throw new Error('Transaction reverted on Monad');
            return receipt;
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        throw new Error('Transaction confirmation timed out');
      },
      provider: 'privy',
      logout: async () => {
        const active = walletRef.current;
        try { await active?.disconnect?.(); } catch (_) {}
        await logout();
        walletRef.current = null;
        window.StanceWallet = null;
        window.StanceWalletProvider = null;
        announceDisconnect('privy');
      }
    };
    window.StanceWalletProvider = 'privy';
  }, [connectOrCreateWallet, logout, wallet]);

  const disabled = !ready;
  const label = wallet ? short(wallet.address) : authenticated ? 'Create wallet' : 'Sign in / Connect';
  return React.createElement('span', { style: { display: 'grid', gap: 7 } },
    React.createElement('button', {
      id: 'connect-wallet', style: buttonStyle, disabled,
      title: wallet ? 'Privy wallet connected on Monad' : 'Sign in with email, passkey, or an external wallet',
      onClick: () => {
        if (wallet) return;
        window.StanceWalletProvider = 'privy';
        connectOrCreateWallet().catch(error => console.error('Privy wallet connection failed', error));
      }
    }, label),
    wallet ? React.createElement('button', {
      id: 'disconnect-wallet', style: { ...buttonStyle, color: '#FF9D8A' },
      onClick: () => window.StanceWallet?.logout?.()
    }, 'Disconnect and sign out') : null
  );
}

function injectedFallback() {
  const button = document.getElementById('connect-wallet');
  let account = null;
  if (button) button.textContent = window.ethereum ? 'Connect browser wallet' : 'Install or open a wallet';
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
    announceWallet(account, 'wallet');
    return account;
  };
  window.StanceWallet = {
    chainId: MONAD.id, connect, getAccount: () => account,
    send: async transaction => {
      if (!account) await connect();
      await switchToMonad(window.ethereum);
      return window.ethereum.request({ method: 'eth_sendTransaction', params: [{ ...transaction, from: account }] });
    },
    waitForReceipt: async (hash, timeoutMs = 120000) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const receipt = await window.ethereum.request({ method: 'eth_getTransactionReceipt', params: [hash] });
        if (receipt) {
          if (receipt.status === '0x0') throw new Error('Transaction reverted on Monad');
          return receipt;
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      throw new Error('Transaction confirmation timed out');
    },
    logout: async () => {
      try { await window.ethereum?.request?.({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch (_) {}
      account = null;
      window.StanceWallet = null;
      window.StanceWalletProvider = null;
      announceDisconnect('wallet');
    }
  };
  button?.addEventListener('click', () => connect().catch(error => { button.title = error.message; }));
}

let mountedWalletRoot = null;

async function start() {
  const root = document.getElementById('connect-wallet-root');
  if (!root || root === mountedWalletRoot) return;
  mountedWalletRoot = root;
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
          loginMethods: ['email', 'google', 'wallet'],
          defaultChain: MONAD,
          supportedChains: [MONAD],
          embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } }
        }
      }, React.createElement('div', { style: { display: 'grid', width: '100%', gap: 7 } },
        React.createElement(MeraWalletButton),
        React.createElement(PrivyWalletButton)
      ))
    );
  } catch (error) {
    console.warn('Privy unavailable; using injected wallet fallback', error);
    injectedFallback();
  }
}

start();
const walletRootObserver = new MutationObserver(() => start());
walletRootObserver.observe(document.documentElement, { childList: true, subtree: true });
