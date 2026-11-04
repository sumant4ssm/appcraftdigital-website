/* AppCraft Digital — shared behaviour for all pages */
(function () {
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  var wide = window.matchMedia('(min-width: 900px)');
  var explorers = Array.prototype.map.call(document.querySelectorAll('[data-explorer]'), initExplorer);

  // Decides whether a feature stays visible for the current search text.
  // `query` is already trimmed and lower-cased, and never empty here.
  // `text` holds the feature's searchable words, all lower-cased:
  //   text.name    – the feature title, e.g. "intruder selfie"
  //   text.summary – the one-line description shown under the title
  //   text.details – everything in the expanded panel (description + spec rows)
  function matchesQuery(text, query) {
    // TODO(you): decide how search should behave (see the note in chat).
    // For now this is a plain substring check on the title and one-liner.
    return (text.name + ' ' + text.summary).indexOf(query) !== -1;
  }

  function initExplorer(root) {
    var grid = root.querySelector('.feature-grid');
    var tabs = Array.prototype.slice.call(root.querySelectorAll('.feature-tab'));
    var labels = Array.prototype.slice.call(root.querySelectorAll('.group-label'));
    var tools = root.querySelector('.explorer-tools');
    var filterBox = root.querySelector('.filters');
    var search = root.querySelector('.search input');
    var empty = root.querySelector('.explorer-empty');
    var state = { group: 'all', query: '' };

    tabs.forEach(function (tab) {
      var panel = panelFor(tab);
      tab._text = {
        name: tab.querySelector('b').textContent.toLowerCase(),
        summary: (tab.querySelector('small') || { textContent: '' }).textContent.toLowerCase(),
        details: panel.textContent.replace(/\s+/g, ' ').toLowerCase()
      };
    });

    // Category filters are built from the group labels so the markup only
    // names each group once.
    var filters = [{ group: 'all', name: 'All', count: tabs.length }].concat(labels.map(function (label) {
      return {
        group: label.dataset.group,
        name: label.textContent,
        count: tabs.filter(function (t) { return t.dataset.group === label.dataset.group; }).length
      };
    }));
    filters.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.group = f.group;
      b.setAttribute('aria-pressed', String(f.group === 'all'));
      b.appendChild(document.createTextNode(f.name + ' '));
      var n = document.createElement('span');
      n.textContent = f.count;
      b.appendChild(n);
      b.addEventListener('click', function () { setGroup(f.group); });
      filterBox.appendChild(b);
    });
    tools.hidden = false;

    search.addEventListener('input', function () {
      state.query = search.value.trim().toLowerCase();
      apply();
    });

    empty.querySelector('button').addEventListener('click', function () {
      search.value = '';
      state.query = '';
      setGroup('all');
      search.focus();
    });

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        // On wide screens the detail pane always shows one feature, so a
        // click only ever opens. On phones it is an accordion.
        if (!wide.matches && isOpen(tab)) setOpen(tab, false);
        else openOnly(tab);
        if (isOpen(tab)) history.replaceState(null, '', '#' + tab.getAttribute('aria-controls'));
      });
      tab.addEventListener('keydown', function (e) {
        var visible = visibleTabs();
        var i = visible.indexOf(tab);
        var next = null;
        if (e.key === 'ArrowDown') next = visible[i + 1];
        else if (e.key === 'ArrowUp') next = visible[i - 1];
        else if (e.key === 'Home') next = visible[0];
        else if (e.key === 'End') next = visible[visible.length - 1];
        else return;
        e.preventDefault();
        if (!next) return;
        next.focus();
        if (wide.matches) openOnly(next);
      });
    });

    function panelFor(tab) { return document.getElementById(tab.getAttribute('aria-controls')); }
    function isOpen(tab) { return tab.getAttribute('aria-expanded') === 'true'; }
    function visibleTabs() { return tabs.filter(function (t) { return !t.hidden; }); }

    function setOpen(tab, open) {
      tab.setAttribute('aria-expanded', String(open));
      panelFor(tab).classList.toggle('is-open', open);
    }

    function openOnly(tab) {
      tabs.forEach(function (t) { setOpen(t, t === tab); });
    }

    function setGroup(group) {
      state.group = group;
      Array.prototype.forEach.call(filterBox.children, function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.group === group));
      });
      apply();
    }

    function apply() {
      tabs.forEach(function (tab) {
        var inGroup = state.group === 'all' || tab.dataset.group === state.group;
        var show = inGroup && (!state.query || matchesQuery(tab._text, state.query));
        tab.hidden = !show;
        if (!show) setOpen(tab, false);
      });
      // Group headings only help while several groups are listed together.
      labels.forEach(function (label) {
        label.hidden = state.group !== 'all' || !tabs.some(function (t) {
          return !t.hidden && t.dataset.group === label.dataset.group;
        });
      });
      var visible = visibleTabs();
      var rows = visible.length + labels.filter(function (l) { return !l.hidden; }).length;
      grid.style.setProperty('--rows', Math.max(rows, 1));
      empty.hidden = visible.length > 0;
      if (!visible.length) empty.querySelector('q').textContent = search.value.trim();
      ensureOpen();
    }

    function ensureOpen() {
      if (!wide.matches || tabs.some(isOpen)) return;
      var first = visibleTabs()[0];
      if (first) setOpen(first, true);
    }

    // Opens the feature named in the URL (e.g. /applock-ultra/#intruder-selfie)
    function openFromHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      var tab = id && root.querySelector('.feature-tab[aria-controls="' + CSS.escape(id) + '"]');
      if (!tab) return false;
      search.value = '';
      state.query = '';
      setGroup('all');
      openOnly(tab);
      // Instant, so the position can be measured straight after. On wide
      // screens show the tools first, then make sure the chosen row is in view.
      if (wide.matches) {
        root.scrollIntoView({ block: 'start', behavior: 'instant' });
        if (tab.getBoundingClientRect().bottom > window.innerHeight) {
          tab.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      } else {
        tab.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      return true;
    }

    apply();
    return { openFromHash: openFromHash, ensureOpen: ensureOpen };
  }

  function onHash() {
    explorers.forEach(function (x) { x.openFromHash(); });
  }
  window.addEventListener('hashchange', onHash);
  if (location.hash) onHash();

  var onWide = function () { explorers.forEach(function (x) { x.ensureOpen(); }); };
  if (wide.addEventListener) wide.addEventListener('change', onWide);
  else if (wide.addListener) wide.addListener(onWide);
})();
