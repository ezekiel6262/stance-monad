import { readFileSync } from 'node:fs';
import { encodeDeployData, isAddress } from 'viem';
import { json } from './_shared.js';
import { KURU_TOKENS } from './_kuru.js';

const AUTHORIZED_DEPLOYER = '0xB96f92E221935E4b0E0d7e927dF2E8e74147F785';
const marketArtifact = JSON.parse(readFileSync(new URL('../contracts/artifacts/StanceMarket.json', import.meta.url), 'utf8'));
const portfolioArtifact = JSON.parse(readFileSync(new URL('../contracts/artifacts/StancePortfolio.json', import.meta.url), 'utf8'));

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const wallet = String(req.query?.wallet || '');
  if (!isAddress(wallet) || wallet.toLowerCase() !== AUTHORIZED_DEPLOYER.toLowerCase()) {
    return json(res, 403, { ok: false, error: 'unauthorized_deployer' });
  }
  const marketData = encodeDeployData({
    abi: marketArtifact.abi,
    bytecode: marketArtifact.bytecode.object,
    args: [KURU_TOKENS.USDC.address, AUTHORIZED_DEPLOYER, AUTHORIZED_DEPLOYER]
  });
  const portfolioData = encodeDeployData({ abi: portfolioArtifact.abi, bytecode: portfolioArtifact.bytecode.object });
  return json(res, 200, {
    ok: true,
    chainId: 143,
    deployer: AUTHORIZED_DEPLOYER,
    owner: AUTHORIZED_DEPLOYER,
    resolver: AUTHORIZED_DEPLOYER,
    collateral: KURU_TOKENS.USDC.address,
    transactions: [
      { kind: 'StanceMarket', chainId: 143, data: marketData, value: '0' },
      { kind: 'StancePortfolio', chainId: 143, data: portfolioData, value: '0' }
    ]
  });
}
