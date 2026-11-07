/* AppCraft Digital — shared behaviour for all pages */
(function () {
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Light / dark switch. Until the visitor picks one, the page follows the
  // device setting; a pick is remembered in localStorage (not a cookie).
  var root = document.documentElement;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var themeButton = document.querySelector('.theme-toggle');
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : darkQuery.matches;
  }
  function labelTheme() {
    if (themeButton) themeButton.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  }
  if (themeButton) {
    themeButton.hidden = false;
    labelTheme();
    themeButton.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      labelTheme();
    });
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', labelTheme);
  }

  // ---------- Scroll animations ----------
  // Only when the <head> script turned them on (.anim: motion allowed and
  // IntersectionObserver available). Keep REVEAL in step with style.css.
  var REVEAL = '.hero-grid > :not(.wordmark), .section-head > *, .intro .cta, .intro .note, .icon-grid li, ' +
    '.app-row, .coming > *, .principles > div, .contact > *, .app-hero-grid > *, .facts > div, ' +
    '.explorer-tools, .privacy-list > div, .faq details, .related a, .foot-grid > div, .notfound .wrap > *';
  var animating = root.classList.contains('anim');
  if (animating) {
    root.classList.add('anim-ready');
    var revealed = function (el) { el.classList.add('in'); };
    var watch = function (margin) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealed(entry.target);
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -' + margin + '% 0px', threshold: 0 });
      return io;
    };
    // As in the original: items play once their top passes 85% of the
    // window, sections (rule, crosses, label) at 88%.
    var itemWatch = watch(15);
    var sectionWatch = watch(12);

    Array.prototype.forEach.call(document.querySelectorAll(REVEAL), function (el) {
      var parent = el.parentElement;
      var delay;
      if (parent.classList.contains('hero-grid')) {
        // In the home hero the words follow the title's letters, 0.08s apart.
        var siblings = Array.prototype.filter.call(parent.children, function (c) { return c.matches(REVEAL); });
        delay = 0.55 + siblings.indexOf(el) * 0.08;
      } else {
        // Items side by side come in left to right: up to 0.18s across a row.
        var pr = parent.getBoundingClientRect();
        var r = el.getBoundingClientRect();
        delay = pr.width > 0 ? Math.max(0, (r.left - pr.left) / pr.width) * 0.18 : 0;
      }
      el.style.setProperty('--d', delay.toFixed(3) + 's');
      itemWatch.observe(el);
    });
    Array.prototype.forEach.call(document.querySelectorAll('main > section, footer.site, .crumbs-wrap'), function (el) {
      sectionWatch.observe(el);
    });
    // The title's letters rise once the page has drawn its first frame.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        Array.prototype.forEach.call(document.querySelectorAll('.wordmark'), revealed);
      });
    });
    initScrollIndex();
    initSmoothScroll();
    initProgressLine();
  }

  // ---------- Gliding wheel scrolling ----------
  // Like the original, a mouse wheel or trackpad doesn't jump the page: each
  // turn moves a target and the page eases towards it (12% of the gap per
  // frame). Keyboard, scrollbar, touch and links scroll natively, and any
  // of them cancels a glide in progress. Boxes that scroll on their own
  // keep their wheel.
  function initSmoothScroll() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    var target = 0, current = 0, gliding = false, last = 0;
    var LERP = 0.12;

    function maxScroll() { return document.documentElement.scrollHeight - window.innerHeight; }
    function scrollsItself(el, dy) {
      for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        var oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        }
      }
      return false;
    }
    function stop() { gliding = false; }

    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (!root.classList.contains('anim')) return;
      if (scrollsItself(e.target, e.deltaY)) return;
      var unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
      e.preventDefault();
      if (!gliding) { target = current = window.scrollY; last = 0; }
      target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * unit));
      if (!gliding) { gliding = true; requestAnimationFrame(step); }
    }, { passive: false });

    function step(now) {
      if (!gliding) return;
      // Someone else moved the page (scrollbar, a link): let them have it.
      if (Math.abs(window.scrollY - Math.round(current)) > 3) { stop(); return; }
      var frames = last ? Math.min((now - last) / 16.667, 4) : 1;
      last = now;
      current += (target - current) * (1 - Math.pow(1 - LERP, frames));
      if (Math.abs(target - current) < 0.5) { current = target; gliding = false; }
      window.scrollTo({ top: current, behavior: 'instant' });
      if (gliding) requestAnimationFrame(step);
    }
    ['keydown', 'mousedown', 'touchstart'].forEach(function (type) {
      window.addEventListener(type, stop, { passive: true });
    });
  }

  // ---------- Reading progress on narrow screens ----------
  // Where there's no room for the ruler, a hairline under the header fills
  // from left to right as you read down the page.
  function initProgressLine() {
    var line = document.createElement('div');
    line.className = 'scroll-progress';
    line.setAttribute('aria-hidden', 'true');
    document.body.appendChild(line);
    var queued = false;
    function update() {
      queued = false;
      var room = document.documentElement.scrollHeight - window.innerHeight;
      var p = room > 0 ? Math.min(Math.max(window.scrollY / room, 0), 1) : 0;
      line.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    function ask() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    update();
  }

  // ---------- Scroll index, ruler and the flying title ----------
  // Wide screens only. Every section gets its name in the right margin:
  //   queued  – small, stacked at the bottom, while the section is below
  //   riding  – turned on its side, travelling down the rail with the
  //             section's top edge as it scrolls up the window
  //   current – full size at the top right once the section's top passes
  //             the flip line (12% of the window below the header)
  //   past    – small again, piled above the current one
  // Every frame each name eases towards where its state puts it, so state
  // changes glide instead of jumping. On the home page the big title is
  // the first name: scrolling flies its letters up into the corner.
  function initScrollIndex() {
    var NAV = 48, RAIL = 56, GAP = 14, TOP_PAD = 16, SLOT = 20, QUEUE_PAD = 26;
    var HEAD = 34, RIDE = 20, SMALL = 16;
    var wideQuery = window.matchMedia('(min-width: 1100px)');
    var hero = document.querySelector('main > .hero');
    var wordmark = hero && hero.querySelector('.wordmark');

    var items = [];
    var layer = document.createElement('nav');
    layer.className = 'scroll-index';
    layer.setAttribute('aria-hidden', 'true');

    Array.prototype.forEach.call(document.querySelectorAll('main > section'), function (section, i) {
      if (section === hero && wordmark) { items.push(makeFlyWord(section)); return; }
      var name = section.classList.contains('app-hero')
        ? section.querySelector('h1')
        : section.querySelector('.bar b');
      if (!name) return;
      if (!section.id) section.id = section.classList.contains('app-hero') ? 'top' : 'section-' + (i + 1);
      var a = document.createElement('a');
      a.href = '#' + section.id;
      a.tabIndex = -1;
      a.textContent = name.textContent.trim();
      layer.appendChild(a);
      items.push({ el: a, section: section });
    });
    if (items.length < 2) return;
    document.body.appendChild(layer);

    var rail = document.createElement('div');
    rail.className = 'scroll-rail';
    rail.setAttribute('aria-hidden', 'true');
    document.body.appendChild(rail);

    // How far down the page you are, as rolling digits pinned to the rail
    // at the flip line: each digit is a column of 0–9 that slides.
    var readout = document.createElement('div');
    readout.className = 'scroll-readout';
    readout.setAttribute('aria-hidden', 'true');
    var digitCols = [0, 1, 2].map(function () {
      var wrap = document.createElement('span');
      wrap.className = 'digit';
      var col = document.createElement('span');
      for (var n = 0; n <= 9; n++) {
        var d = document.createElement('span');
        d.textContent = n;
        col.appendChild(d);
      }
      wrap.appendChild(col);
      readout.appendChild(wrap);
      return { wrap: wrap, col: col, shown: -1 };
    });
    var pctSign = document.createElement('i');
    pctSign.textContent = '%';
    readout.appendChild(pctSign);
    document.body.appendChild(readout);
    var lastPct = -1;
    function showPercent(pct, flip) {
      readout.style.top = Math.round(flip - 9) + 'px';
      if (pct === lastPct) return;
      lastPct = pct;
      var text = String(pct);
      while (text.length < 3) text = ' ' + text;
      digitCols.forEach(function (c, i) {
        var ch = text.charAt(i);
        c.wrap.classList.toggle('is-blank', ch === ' ');
        var n = ch === ' ' ? 0 : +ch;
        if (n !== c.shown) { c.col.style.transform = 'translateY(' + (-n) + 'em)'; c.shown = n; }
      });
    }

    // The title as a set of loose letters that can leave the hero.
    function makeFlyWord(section) {
      var parts = [wordmark.querySelector('img')].concat(Array.prototype.slice.call(wordmark.querySelectorAll('.wm-word > span')));
      var box = document.createElement('div');
      box.className = 'fly-word';
      box.setAttribute('aria-hidden', 'true');
      box.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
      var letters = parts.filter(Boolean).map(function (src) {
        var copy;
        if (src.tagName === 'IMG') {
          copy = document.createElement('img');
          copy.src = src.src;
          copy.alt = '';
        } else {
          copy = document.createElement('span');
          copy.textContent = src.textContent;
        }
        box.appendChild(copy);
        return { src: src, el: copy };
      });
      layer.appendChild(box);
      return { el: box, section: section, fly: true, letters: letters };
    }

    function measure() {
      var vw = document.documentElement.clientWidth;
      items.forEach(function (it) {
        if (it.fly) {
          var font = parseFloat(getComputedStyle(wordmark).fontSize) || 96;
          it.el.style.fontSize = font + 'px';
          var first = it.letters[0].src;
          var last = it.letters[it.letters.length - 1].src;
          it.font = font;
          it.wNatural = last.offsetLeft + last.offsetWidth - first.offsetLeft;
          it.w = it.wNatural * HEAD / font;       // its width when shown at 34px
          it.h = HEAD;
          it.letters.forEach(function (l) {
            l.dx = l.src.offsetLeft - first.offsetLeft;
            l.dy = l.src.offsetTop - wordmark.offsetTop;
            if (l.el.tagName === 'IMG') { l.el.style.width = l.src.offsetWidth + 'px'; l.el.style.height = l.src.offsetHeight + 'px'; }
          });
        } else {
          it.w = it.el.offsetWidth;
          it.h = it.el.offsetHeight;
        }
      });
      // Ruler: a tick every 1% of the page, a numbered one every 5%.
      rail.style.height = '0px';
      var docH = document.documentElement.scrollHeight;
      rail.style.height = docH + 'px';
      rail.style.setProperty('--tick', (docH / 100).toFixed(2) + 'px');
      rail.textContent = '';
      for (var pct = 0; pct <= 100; pct += 5) {
        var mark = document.createElement('span');
        mark.style.top = Math.min(pct / 100 * docH, docH - 1) + 'px';
        var label = document.createElement('b');
        label.textContent = pct;
        mark.appendChild(label);
        rail.appendChild(mark);
      }
      return vw;
    }

    function targets() {
      var vw = document.documentElement.clientWidth;
      var vh = window.innerHeight;
      var right = vw - RAIL - GAP;
      var flip = NAV + vh * 0.12;
      var tops = items.map(function (it) { return it.section.getBoundingClientRect().top; });
      var current = 0;
      tops.forEach(function (t, i) { if (t <= flip) current = i; });
      items.forEach(function (it, i) {
        var s, x, y, r = 0, state;
        if (i < current) {
          state = 'past';
          s = SMALL / HEAD;
          y = NAV + TOP_PAD + i * SLOT;
          x = right - it.w;
        } else if (i === current) {
          state = 'current';
          s = 1;
          y = NAV + TOP_PAD + i * SLOT + (i ? 6 : 0);
          x = right - it.w;
        } else {
          var queueY = vh - QUEUE_PAD - (items.length - i) * SLOT;
          if (tops[i] < queueY) {
            // On its side: turning -90° about its top-right corner makes the
            // word hang down from that corner, reading upwards.
            state = 'riding';
            s = RIDE / HEAD;
            r = -90;
            x = vw - RAIL - 6 - it.h * s - it.w;
            y = Math.max(tops[i], flip);
          } else {
            state = 'queued';
            s = SMALL / HEAD;
            y = queueY;
            x = right - it.w;
          }
        }
        it.state = state;
        it.target = { x: x, y: y, r: r, s: s };
      });
      // Let the features panel on app pages sit below the pile.
      var pileBottom = NAV + TOP_PAD + current * SLOT + 6 + HEAD + 12;
      root.style.setProperty('--index-h', Math.round(pileBottom - NAV) + 'px');
      var room = document.documentElement.scrollHeight - vh;
      showPercent(room > 0 ? Math.round(Math.min(Math.max(window.scrollY / room, 0), 1) * 100) : 0, flip);
    }

    var running = false;
    var lastTime = 0;
    var fresh = true;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function frame(now) {
      var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0.016;
      lastTime = now;
      targets();
      var k = fresh ? 1 : 1 - Math.exp(-dt * 12);
      fresh = false;
      var moving = false;
      items.forEach(function (it) {
        var t = it.target;
        var c = it.cur || (it.cur = { x: t.x, y: t.y, r: t.r, s: t.s });
        ['x', 'y', 'r', 's'].forEach(function (key) {
          var d = t[key] - c[key];
          c[key] += d * k;
          if (Math.abs(d) > (key === 's' ? 0.002 : 0.3)) moving = true;
        });
        it.el.classList.toggle('is-current', it.state === 'current');
        it.el.classList.toggle('is-past', it.state === 'past');
        if (it.fly) placeFlyWord(it);
        else it.el.style.transform = 'translate(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px) rotate(' + c.r.toFixed(2) + 'deg) scale(' + c.s.toFixed(4) + ')';
      });
      if (moving) requestAnimationFrame(frame);
      else { running = false; lastTime = 0; }
    }

    // The title's letters leave one after another over the first half of
    // the hero, each sliding from its place in the hero to its place in the
    // corner heading.
    function placeFlyWord(it) {
      var heroH = it.section.offsetHeight || 1;
      var p = Math.min(Math.max(window.scrollY / (heroH * 0.5), 0), 1);
      root.classList.toggle('flying', p > 0);
      it.el.style.visibility = p > 0 ? 'visible' : 'hidden';
      if (p <= 0) return;
      var grid = wordmark.parentElement.getBoundingClientRect();
      var c = it.cur;
      var boxLeft = c.x + it.w - it.w * c.s;   // right edge stays put as it shrinks
      var unit = c.s * HEAD / it.font;          // letter scale in the corner
      var n = it.letters.length;
      var stagger = 0.04;
      it.letters.forEach(function (l, j) {
        var pj = Math.min(Math.max((p - j * stagger) / (1 - (n - 1) * stagger), 0), 1);
        var e = ease(pj);
        var fromX = grid.left + l.src.offsetLeft;
        var fromY = grid.top + l.src.offsetTop;
        var toX = boxLeft + l.dx * unit;
        var toY = c.y + l.dy * unit;
        // Mid-flight each letter lifts on a slight arc and tips, alternately
        // left and right, then settles flat in the corner.
        var arc = Math.sin(Math.PI * e);
        var x = fromX + (toX - fromX) * e;
        var y = fromY + (toY - fromY) * e - arc * 36;
        var s = 1 + (unit - 1) * e;
        var tilt = arc * (j % 2 ? 7 : -7);
        l.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + tilt.toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
      });
    }

    function kick() {
      if (!root.classList.contains('has-index') || running) return;
      running = true;
      requestAnimationFrame(frame);
    }
    function setup() {
      var on = wideQuery.matches;
      root.classList.toggle('has-index', on);
      if (!on) { root.classList.remove('flying'); root.style.removeProperty('--index-h'); return; }
      measure();
      fresh = true;
      kick();
    }

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', setup);
    if (wideQuery.addEventListener) wideQuery.addEventListener('change', setup);
    // Fonts and pictures change the page's height and the title's width.
    window.addEventListener('load', setup);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup);
    setup();
  }

  // Phone menu: the header links fold behind a button on narrow screens.
  var nav = document.querySelector('header.site .nav');
  var menuButton = document.querySelector('.menu-toggle');
  if (nav && menuButton) {
    menuButton.hidden = false;
    var setMenu = function (open) {
      nav.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    };
    menuButton.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('.nav-links a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); menuButton.focus(); }
    });
  }

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
