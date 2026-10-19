import { getSettings, isSignedIn, signOut, connect } from './shared.js';
const errorAlert = document.getElementById('errorAlert');
async function render() {
  const settings = await getSettings(), connected = isSignedIn(settings);
  document.getElementById('signedInView').classList.toggle('hidden', !connected);
  document.getElementById('connectView').classList.toggle('hidden', connected);
  document.getElementById('staffNameText').textContent = settings.staffName || '';
  document.getElementById('staffRoleText').textContent = settings.staffRole || '';
  document.getElementById('expiryText').textContent = connected ? `Expires ${new Date(settings.tokenExp * 1000).toLocaleString()}` : '';
}
async function run(button, action) {
  button.disabled = true; errorAlert.classList.add('hidden');
  try { await action(); await render(); }
  catch (error) { errorAlert.textContent = error.message; errorAlert.classList.remove('hidden'); }
  finally { button.disabled = false; }
}
document.getElementById('connectButton').addEventListener('click', event => run(event.currentTarget, connect));
document.getElementById('signOutButton').addEventListener('click', event => run(event.currentTarget, signOut));
render().catch(error => { errorAlert.textContent = error.message; errorAlert.classList.remove('hidden'); });
