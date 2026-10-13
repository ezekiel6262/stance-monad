const steps = [...document.querySelectorAll('.step')];
const progress = document.getElementById('progress-fill');
const status = document.getElementById('auth-status');
const topics = new Set(JSON.parse(localStorage.getItem('stance.onboarding.topics') || '[]'));
let connectedAddress = window.StanceWallet?.getAccount?.() || '';
let connectedProvider = window.StanceWalletProvider || '';
let destination = '/app';

function shortAddress(address) { return address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'Connected account'; }
function showStep(index) {
  steps.forEach(step => step.classList.toggle('active', Number(step.dataset.step) === index));
  progress.style.width = `${(index + 1) * 20}%`;
  scrollTo({ top: 0, behavior: 'smooth' });
}
function notify(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.classList.add('visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => status.classList.remove('visible'), 4200);
}
function recordConnection({ address, provider }) {
  if (!address) return;
  connectedAddress = address;
  connectedProvider = provider || window.StanceWalletProvider || 'wallet';
  localStorage.setItem('stance.onboarding.address', address);
  localStorage.setItem('stance.onboarding.provider', connectedProvider);
  document.getElementById('wallet-address').textContent = shortAddress(address);
  document.getElementById('wallet-provider').textContent = `${connectedProvider === 'mera' ? 'Mera passkey' : 'Privy wallet'} / Monad 143`;
  showStep(1);
}
window.addEventListener('stance:wallet-connected', event => recordConnection(event.detail));
document.querySelectorAll('[data-auth]').forEach(button => button.addEventListener('click', async () => {
  const method = button.dataset.auth;
  button.disabled = true;
  notify(method === 'passkey' ? 'Opening secure passkey prompt...' : 'Opening secure sign in...');
  try {
    const targetId = method === 'passkey' ? 'mera-wallet' : 'connect-wallet';
    const target = document.getElementById(targetId);
    if (!target) throw new Error('Authentication is still loading. Try again in a moment.');
    target.click();
    setTimeout(() => {
      const address = window.StanceWallet?.getAccount?.();
      if (address) recordConnection({ address, provider: window.StanceWalletProvider });
      button.disabled = false;
    }, 1200);
  } catch (error) { button.disabled = false; notify(error.message, true); }
}));
document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.next))));
function renderTopics() {
  document.querySelectorAll('[data-topic]').forEach(button => button.classList.toggle('selected', topics.has(button.dataset.topic)));
  const next = document.getElementById('topics-next');
  next.disabled = topics.size < 2;
  document.getElementById('topic-count').textContent = `${Math.min(topics.size, 2)} / 2`;
}
document.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => {
  const topic = button.dataset.topic;
  topics.has(topic) ? topics.delete(topic) : topics.add(topic);
  renderTopics();
}));
document.getElementById('topics-next').addEventListener('click', () => {
  if (topics.size < 2) return;
  localStorage.setItem('stance.onboarding.topics', JSON.stringify([...topics]));
  showStep(3);
});
document.querySelectorAll('[data-intent]').forEach(button => button.addEventListener('click', () => {
  destination = button.dataset.route;
  localStorage.setItem('stance.onboarding.intent', button.dataset.intent);
  localStorage.setItem('stance.onboarding.complete', 'true');
  document.getElementById('summary-address').textContent = shortAddress(connectedAddress);
  document.getElementById('summary-topics').textContent = [...topics].slice(0, 3).join(', ');
  document.getElementById('summary-intent').textContent = button.querySelector('strong').textContent;
  document.getElementById('launch-app').href = destination;
  showStep(4);
}));
document.getElementById('skip').addEventListener('click', () => location.assign('/app'));
renderTopics();
const existingAddress = localStorage.getItem('stance.onboarding.address');
if (existingAddress) {
  connectedAddress = existingAddress;
  connectedProvider = localStorage.getItem('stance.onboarding.provider') || 'wallet';
}
