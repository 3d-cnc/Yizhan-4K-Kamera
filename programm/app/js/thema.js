// Hell oder dunkel, bevor irgendetwas gezeichnet wird – Vorgabe dunkel, unabhängig von Windows
try { document.documentElement.dataset.thema = localStorage.getItem('yizhan.thema') === 'hell' ? 'hell' : 'dunkel'; }
catch { document.documentElement.dataset.thema = 'dunkel'; }
