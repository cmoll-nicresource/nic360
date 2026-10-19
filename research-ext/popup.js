import { getSettings, isSignedIn, apiFetch, SITE_URL } from './shared.js';
const $ = id => document.getElementById(id);
let extracted;
$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
const normalize = value => value.toLowerCase().replace(/\(bmc\)/gi, '').replace(/[^a-z0-9]+/g, '');
async function init() {
  if (!isSignedIn(await getSettings())) { $('loading').classList.add('hidden'); $('signedOut').classList.remove('hidden'); return; }
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.id || !tab.url?.startsWith('https://')) throw new Error('Open a journal article on an HTTPS page first.');
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['contentScript.js']});
  const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:() => window.__nicResearchExtract()});
  extracted = result;
  for (const key of ['title','authors','publishedDate','doiLink','body']) $(key).value = result[key] || '';
  const {journals} = await apiFetch('/api/extension/research');
  for (const journal of journals) { const option = document.createElement('option'); option.value = journal.id; option.textContent = journal.name; $('journal').appendChild(option); }
  let matched = journals.find(j => normalize(j.name) === normalize(result.journal));
  if (!matched && result.journal) matched = journals.find(j => { try { return normalize(new URL(j.homepage).pathname.split('/').filter(Boolean).at(-1) || '') === normalize(result.journal); } catch { return false; } });
  if (!matched && /^jama\b/i.test(result.journal)) matched = journals.find(j => /^jama\b/i.test(j.name));
  if (!matched) { const hosts = journals.filter(j => { try { return new URL(j.homepage).hostname === new URL(result.sourceUrl).hostname; } catch { return false; } }); if (hosts.length === 1) matched = hosts[0]; }
  if (matched) $('journal').value = matched.id;
  $('journalHint').textContent = matched ? 'Review the matched journal.' : `Journal detected: ${result.journal || 'unknown'}. Choose the journal, or leave it for review. Only admins add journals.`;
  $('result').textContent = result.warnings.join(' ');
  $('loading').classList.add('hidden'); $('clipForm').classList.remove('hidden');
}
$('clipForm').addEventListener('submit', async event => {
  event.preventDefault(); $('save').disabled = true; $('editLink').classList.add('hidden');
  try {
    const data = Object.fromEntries(['title','authors','publishedDate','doiLink','body'].map(key => [key,$(key).value]));
    const result = await apiFetch('/api/extension/research',{method:'POST',body:JSON.stringify({...data,journalId:$('journal').value,sourceUrl:extracted.sourceUrl})});
    $('result').textContent = (result.duplicate ? 'Already tracked. Open the existing record for review.' : 'Research draft created.') + (result.warnings.length ? ' Review: '+result.warnings.join('; ')+'.' : '');
    $('editLink').href = SITE_URL + result.editUrl; $('editLink').classList.remove('hidden');
  } catch (error) { $('result').textContent = error.message; } finally { $('save').disabled = false; }
});
init().catch(error => { $('loading').classList.add('hidden'); $('result').textContent = error.message; });
