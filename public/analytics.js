/* Statistiche facoltative: nessun dato della configurazione o del preventivo. */
(async () => {
  const current = document.currentScript;
  if (!current || location.hostname !== 'betta-design-lab.github.io') return;
  try {
    const response = await fetch(new URL('analytics-config.json', current.src), {cache: 'no-store'});
    if (!response.ok) return;
    const config = await response.json();
    if (config.enabled !== true || config.hostname !== location.hostname ||
        !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.goatcounter\.com\/count$/.test(config.endpoint)) return;
    if (document.querySelector('script[data-goatcounter]')) return;
    let referrer = '';
    try { referrer = document.referrer ? new URL(document.referrer).origin : ''; } catch {}
    const counter = document.createElement('script');
    counter.src = 'https://gc.zgo.at/count.js';
    counter.async = true;
    counter.setAttribute('data-goatcounter', config.endpoint);
    counter.setAttribute('data-goatcounter-settings', JSON.stringify({
      path: location.pathname || '/', title: document.title, referrer, no_events: true
    }));
    document.head.appendChild(counter);
  } catch {
    // Un contatore non disponibile non interrompe i generatori.
  }
})();
