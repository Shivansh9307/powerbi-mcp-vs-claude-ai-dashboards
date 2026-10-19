/* F1 Evolution - application shell: navigation, global filter toolbar, render loop. */
(function () {
  'use strict';
  const F1 = window.F1, ui = F1.ui, h = ui.h, fmt = F1.fmt;
  const NAV = [
    ['overview', 'Overview'], ['drivers', 'Driver Intelligence'], ['constructors', 'Constructor Analysis'],
    ['races', 'Race & Circuit Explorer'], ['quali', 'Qualifying & Race Performance'], ['pits', 'Pit Stop Analysis'],
    ['eras', 'F1 Through the Eras'], ['quality', 'Data Quality & Coverage'],
  ];
  F1.NAV = NAV;
  F1.pages = F1.pages || {};
  F1.ps = F1.ps || {};                    // page-local UI state (metric switches, selections)
  const root = document.getElementById('f1');
  let current = 'overview';
  let navCollapsed = false;
  let lastSig = '', lastW = 0, toastT = null;

  /* ------------------------------------------------------------------ shared page helpers */
  F1.name = {
    driver: (id) => (F1.M.drivers.get(id) || {}).name || id,
    cons: (id) => (F1.M.cons.get(id) || {}).name || id,
    circuit: (id) => (F1.M.circuits.get(id) || {}).name || id,
  };
  F1.go = () => render(true);
  F1.navigate = (id) => { current = id; try { dash.setLink(id); } catch (e) { /* link is optional */ } render(true); window.scrollTo(0, 0); };
  F1.pick = (patch) => { toast(F1.setState(patch)); render(true); };
  F1.rangeLabel = (s) => (s.y0 === s.y1 ? '' + s.y0 : s.y0 + '–' + s.y1);
  F1.scopeText = function () {
    const s = F1.state, bits = [];
    bits.push(s.driver ? F1.name.driver(s.driver) : 'All drivers');
    bits.push(s.cons ? F1.name.cons(s.cons) : 'all constructors');
    bits.push(s.circuit ? F1.name.circuit(s.circuit) : 'all circuits');
    return bits.join(' · ') + ' · ' + F1.rangeLabel(s);
  };
  F1.chips = function () {
    const s = F1.state, M = F1.M, out = [];
    const def = s.y0 === M.minYear && s.y1 === M.maxYear;
    out.push(h('span', { class: 'chip' + (def ? '' : ' on') }, 'Seasons ', h('b', null, F1.rangeLabel(s)), def ? null : h('button', { 'aria-label': 'Reset season range', onclick: () => F1.pick({ y0: M.minYear, y1: M.maxYear }) }, '×')));
    [['driver', 'Driver', F1.name.driver], ['cons', 'Constructor', F1.name.cons], ['circuit', 'Circuit', F1.name.circuit]].forEach(([k, l, f]) => {
      if (s[k]) out.push(h('span', { class: 'chip on' }, l + ' ', h('b', null, f(s[k])), h('button', { 'aria-label': 'Clear ' + l + ' filter', onclick: () => F1.pick({ [k]: null }) }, '×')));
    });
    if (!F1.isFiltered()) out.push(h('span', { class: 'dim' }, 'No filters active — showing the full dataset'));
    return h('div', { class: 'chips', 'aria-label': 'Active filters' }, out);
  };
  /* headline = one generated sentence that states the takeaway for the current selection */
  F1.pageHead = function (eyebrow, title, blurb, headline) {
    const hl = headline || F1.nextHeadline; F1.nextHeadline = null;
    return h('div', null,
      h('div', { class: 'ph' }, h('div', null, h('div', { class: 'eyebrow' }, eyebrow), h('h1', null, title))),
      hl ? h('p', { class: 'headline' }, hl) : null,
      blurb ? h('p', { class: 'scope' }, blurb) : null, F1.chips(), F1.noticeBar(), F1.partialBanner(!(eyebrow === 'Overview' || eyebrow.indexOf('Data Quality') === 0)));
  };
  F1.setHeadline = function (headEl, text) {
    if (!text || !headEl) return;
    headEl.children[0].after(h('p', { class: 'headline' }, text));
  };
  F1.noticeBar = () => null;
  F1.partialBanner = function (compact) {
    const p = F1.partialYearsIn(F1.state);
    if (!p.length) return null;
    if (compact) return h('div', { class: 'chips' }, h('span', { class: 'pnote', title: 'Partial seasons are hatched on season charts and never receive a title.' }, p.map((s) => `${s.year} is a partial season: ${s.held} of ${s.sched} races so far`).join(' · ')));
    return ui.banner('warn', h('b', null, 'Partial season in range. '), p.map((s) => `${s.year}: ${s.held} of ${s.sched} scheduled races have results (latest ${s.lastRace.name}, ${s.lastRace.date}). `),
      'Its totals and rates are provisional, it is hatched on season charts, and no title is awarded for it.');
  };
  F1.hostLoading = (n) => h('div', { class: 'host' }, ui.skeleton(n || 4));
  F1.needs = (page) => (F1.pages[page] && F1.pages[page].needs) || [];
  /* a card whose body is drawn after insertion (charts need a measured width) */
  F1.chartCard = function (o, draw) {
    const host = h('div', { class: 'host', style: o.minH ? { minHeight: o.minH + 'px' } : null });
    const card = ui.card(o, host);
    if (o.src) card.setAttribute('data-source', o.src);
    const setTitle = (t) => { try { const h3 = card.children[0].children[0].children[0]; if (t && h3.firstChild) h3.firstChild.nodeValue = t; } catch (e) { /* title is cosmetic */ } };
    queueMicrotask(() => { try { draw(host, setTitle); } catch (e) { host.replaceChildren(ui.empty('This chart could not be drawn', String(e.message || e))); console.error(e); } });
    return card;
  };
  F1.entityLink = (kind, id, label) => h('button', { type: 'button', class: 'btn ghost', style: { height: '22px', padding: '0 8px' }, onclick: (e) => { e.stopPropagation(); F1.pick({ [kind]: id }); } }, label || 'Filter');

  /* ------------------------------------------------------------------ toast */
  function toast(notes) {
    document.querySelectorAll('.f1 .toast').forEach((t) => t.remove());
    if (!notes || !notes.length) return;
    const t = h('div', { class: 'toast', role: 'status' }, notes.map((n) => h('div', null, n)));
    root.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 9000);
  }

  /* ------------------------------------------------------------------ toolbar */
  function toolbar() {
    const s = F1.state, M = F1.M;
    const yearOpts = (sel) => M.years.map((y) => h('option', { value: y, selected: y === sel ? true : null }, y + (M.seasons.get(y).complete ? '' : '*')));
    const eraMatch = F1.ERAS.find((e) => e.y0 === s.y0 && e.y1 === s.y1);
    const eraSel = h('select', { class: 'tb-sel era-sel', 'aria-label': 'Era preset', onchange: (e) => { const er = F1.ERAS.find((x) => x.id === e.target.value); if (er) F1.pick({ y0: er.y0, y1: er.y1 }); } },
      !eraMatch ? h('option', { value: 'custom', selected: true }, 'Custom range') : null,
      F1.ERAS.map((er) => h('option', { value: er.id, selected: eraMatch && eraMatch.id === er.id ? true : null }, er.label + (er.ext ? ' †' : ''))));
    eraSel.title = '† era boundary is external context, not a dataset field';
    const mkYear = (k, label) => h('div', { class: 'tb-group' }, h('label', { class: 'tb-l', for: 'tb-' + k }, label),
      h('select', { id: 'tb-' + k, class: 'tb-sel', onchange: (e) => F1.pick({ [k]: +e.target.value }) }, yearOpts(s[k])));
    const bar = h('div', { class: 'toolbar', role: 'search', 'aria-label': 'Global filters' },
      h('div', { class: 'tb-group' }, h('span', { class: 'tb-l' }, 'Era'), eraSel),
      mkYear('y0', 'From'), mkYear('y1', 'To'),
      ui.combo({ label: 'Driver', placeholder: 'All drivers', options: F1.options('driver'), value: s.driver, onChange: (id) => F1.pick({ driver: id }) }),
      ui.combo({ label: 'Constructor', placeholder: 'All constructors', options: F1.options('cons'), value: s.cons, onChange: (id) => F1.pick({ cons: id }) }),
      ui.combo({ label: 'Circuit', placeholder: 'All circuits', options: F1.options('circuit'), value: s.circuit, onChange: (id) => F1.pick({ circuit: id }) }),
      h('div', { class: 'tb-actions' },
        h('button', { type: 'button', class: 'btn' + (F1.isFiltered() ? ' primary' : ''), disabled: F1.isFiltered() ? null : true, onclick: () => { F1.resetState(); render(true); } }, 'Reset filters')));
    return bar;
  }

  /* ------------------------------------------------------------------ shell */
  function nav() {
    return h('nav', { class: 'nav', 'aria-label': 'Sections' },
      h('div', { class: 'brand' }, h('div', { class: 'brand-mark' }), h('div', { class: 'brand-t' }, 'F1 EVOLUTION', h('small', null, 'How the grid took over', F1.M ? h('span', { style: { whiteSpace: 'nowrap' } }, `, ${F1.M.minYear}–${F1.M.maxYear}`) : null))),
      h('ul', { class: 'nav-list' }, NAV.map(([id, label], i) => h('li', null,
        h('button', { type: 'button', class: 'nav-item', title: label, 'aria-current': id === current ? 'page' : null, onclick: () => F1.navigate(id) },
          h('span', { class: 'nav-n' }, String(i + 1).padStart(2, '0')), h('span', { class: 'nav-l' }, label))))),
      h('button', { type: 'button', class: 'nav-toggle', 'aria-label': navCollapsed ? 'Expand navigation' : 'Collapse navigation', onclick: () => { navCollapsed = !navCollapsed; root.classList.toggle('navc', navCollapsed); render(true); } }, h('span', null, navCollapsed ? '»' : '«'), h('span', { class: 'nav-l' }, ' Collapse')),
      h('div', { class: 'nav-foot' }, h('div', { class: 'nf-t' }, F1.M ? `Data to ${F1.M.lastDate}` : 'Loading…')));
  }

  /* persistent shell: nav + toolbar + page slots are created once; a filter change swaps slot contents only
     (no full-document rebuild, so scroll position, focus ring and tooltip layer survive). */
  let shell = null;
  function ensureShell() {
    if (shell && root.contains(shell.main)) return shell;
    root.replaceChildren();
    const tt = h('div', { class: 'tt', role: 'tooltip' }); ui.tip.el = tt;
    shell = { nav: h('nav', { class: 'nav' }), main: h('main', { class: 'main', id: 'main' }), tb: h('div'), page: h('div', { class: 'page' }), tt };
    shell.main.append(shell.tb, shell.page);
    root.append(shell.nav, shell.main, tt);
    return shell;
  }
  function render(force) {
    if (!root) return;
    const core = F1.loadCore();
    const page = F1.pages[current];
    const needsSig = core.status + '|' + F1.needs(current).map((id) => dash.data(id).status).join(',');
    const w = root.clientWidth;
    if (!force && needsSig === lastSig && Math.abs(w - lastW) < 8) return;
    lastSig = needsSig; lastW = w;
    root.classList.toggle('navc', navCollapsed);
    if (core.status !== 'ok') {
      shell = null; root.replaceChildren();
      const tt = h('div', { class: 'tt', role: 'tooltip' }); ui.tip.el = tt;
      root.append(h('nav', { class: 'nav' }, h('div', { class: 'brand' }, h('div', { class: 'brand-mark' }), h('div', { class: 'brand-t' }, 'F1 EVOLUTION'))),
        h('main', { class: 'main' }, core.status === 'error'
          ? h('div', { class: 'loading-screen' }, h('strong', null, 'Some source tables did not load.'), h('div', null, 'Open Sources to see which one failed.'))
          : h('div', { class: 'page' }, h('div', { class: 'ph' }, h('div', null, h('div', { class: 'eyebrow' }, 'F1 Evolution'), h('h1', null, 'Loading race results…'))), ui.skeleton(6))), tt);
      return;
    }
    const sh = ensureShell(), sy = window.scrollY;
    sh.nav.replaceWith((sh.nav = nav()));
    sh.tb.replaceChildren(toolbar());
    sh.page.id = 'page-' + current;
    let el;
    try { el = page.render(); } catch (e) { el = ui.empty('This section hit an error', String((e && e.message) || e)); console.error(e); }
    sh.page.replaceChildren(el, h('footer', { class: 'pfoot' }, `Source: Formula 1 World Championship tables, ${F1.M.minYear}–${F1.M.maxYear}; latest race with results ${F1.M.lastDate}. Hover ⓘ for each metric’s definition. Comparisons across seasons describe the data and do not establish cause.`));
    ui.tip.hide();
    window.scrollTo(0, sy);
  }

  /* ------------------------------------------------------------------ boot */
  const start = (location.hash || '').slice(1);
  if (F1.pages[start]) current = start;
  dash.onData(() => render(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ui.tip.hide(); });
})();
