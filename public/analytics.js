/* Statistiche facoltative: il tracker non legge dati dei generatori o dei preventivi. */
(async () => {
  const current = document.currentScript;
  if (!current || location.hostname !== 'betta-design-lab.github.io') return;
  try {
    const response = await fetch(new URL('analytics-config.json', current.src), {cache: 'no-store'});
    if (!response.ok) return;
    const config = await response.json();
    if (config.enabled !== true || config.hostname !== location.hostname ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.websiteId)) return;
    if (document.querySelector('script[data-website-id]')) return;
    const tracker = document.createElement('script');
    tracker.src = 'https://cloud.umami.is/script.js';
    tracker.async = true;
    tracker.setAttribute('data-website-id', config.websiteId);
    document.head.appendChild(tracker);
  } catch {
    // Se il contatore non è disponibile, i generatori continuano a funzionare.
  }
})();
