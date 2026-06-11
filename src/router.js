const ROUTES = [
  { pattern: /^#\/read\/([a-z2]+)$/, screen: 'reading', paramNames: ['book'] },
  { pattern: /^#\/dictionary$/, screen: 'dictionary', paramNames: [] },
  { pattern: /^#\/progress$/, screen: 'progress', paramNames: [] },
  { pattern: /^#\/settings$/, screen: 'settings', paramNames: [] },
  { pattern: /^#\/onboarding$/, screen: 'onboarding', paramNames: [] },
  { pattern: /^#\/about$/, screen: 'about', paramNames: [] },
];

export function parse(hash) {
  const h = hash || location.hash || '#/read/john';
  for (const route of ROUTES) {
    const match = h.match(route.pattern);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      return { screen: route.screen, params };
    }
  }
  // Дефолт: чтение Иоанна
  return { screen: 'reading', params: { book: 'john' } };
}

export function navigate(path) {
  location.hash = path;
}

export function onChange(cb) {
  window.addEventListener('hashchange', () => {
    cb(parse(location.hash));
  });
}
