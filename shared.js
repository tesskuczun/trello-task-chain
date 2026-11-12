/* Shared logic for the Task Chain Power-Up (used by client.js and section.js). */
'use strict';

var TC = (function () {
  // A task counts as done when it sits in a list with one of these names
  // (case-insensitive), when its due date is ticked complete, or when it has
  // been archived / removed from the board.
  var DONE_LIST_NAMES = ['done', 'complete', 'completed', 'finished', 'shipped', 'archived'];

  // All links live in one board-level map { cardId: previousCardId } so the
  // whole chain can be read in a single call.
  var LINKS_KEY = 'links';
  var OLD_CARD_KEY = 'prevTaskId'; // where version 1 stored links

  var BASE = new URL('./', window.location.href).toString();
  var ICONS = {
    chain: BASE + 'icon.svg',
    lock: BASE + 'lock.svg',
    check: BASE + 'check.svg',
    flag: BASE + 'flag.svg'
  };

  function isDoneList(list) {
    return !!list && DONE_LIST_NAMES.indexOf(String(list.name).trim().toLowerCase()) !== -1;
  }

  function load(t) {
    return Promise.all([
      t.cards('id', 'name', 'idList', 'closed', 'dueComplete'),
      t.lists('id', 'name'),
      t.get('board', 'shared', LINKS_KEY, {})
    ]).then(function (res) {
      var b = { cards: res[0], cardsById: {}, listsById: {}, links: res[2] || {} };
      res[0].forEach(function (c) { b.cardsById[c.id] = c; });
      res[1].forEach(function (l) { b.listsById[l.id] = l; });
      return b;
    });
  }

  function exists(b, id) { return !!b.cardsById[id]; }

  function isDone(b, id) {
    var c = b.cardsById[id];
    if (!c) return true; // archived or deleted
    return !!c.closed || !!c.dueComplete || isDoneList(b.listsById[c.idList]);
  }

  function name(b, id) {
    var c = b.cardsById[id];
    return c ? c.name : '(archived task)';
  }

  function listName(b, id) {
    var c = b.cardsById[id];
    var l = c && b.listsById[c.idList];
    return l ? l.name : '';
  }

  // Tasks that must be finished before `id`, in the order to do them
  // (first task first, the card's direct previous task last).
  function ancestors(b, id) {
    var out = [];
    var seen = {};
    seen[id] = true;
    var cur = b.links[id];
    while (cur && !seen[cur]) {
      seen[cur] = true;
      out.unshift(cur);
      if (!exists(b, cur)) break; // archived: stop here
      cur = b.links[cur];
    }
    return out;
  }

  function children(b, id) {
    return Object.keys(b.links).filter(function (k) {
      return b.links[k] === id && exists(b, k);
    });
  }

  // Tasks waiting on `id`, nearest first. depth 1 = waits directly on it.
  function descendants(b, id) {
    var out = [];
    var seen = {};
    seen[id] = true;
    var queue = [{ id: id, depth: 0 }];
    while (queue.length) {
      var cur = queue.shift();
      children(b, cur.id).forEach(function (k) {
        if (seen[k]) return;
        seen[k] = true;
        out.push({ id: k, depth: cur.depth + 1 });
        queue.push({ id: k, depth: cur.depth + 1 });
      });
    }
    return out;
  }

  function info(b, id) {
    var anc = ancestors(b, id);
    var desc = descendants(b, id);
    var maxDown = desc.reduce(function (m, d) { return Math.max(m, d.depth); }, 0);
    var prev = b.links[id] || null;
    var step = anc.length + 1;
    var nextUp = null;
    for (var i = 0; i < anc.length; i++) {
      if (!isDone(b, anc[i])) { nextUp = anc[i]; break; }
    }
    return {
      id: id,
      inChain: !!prev || desc.length > 0,
      prev: prev,
      blocked: !!prev && !isDone(b, prev),
      done: isDone(b, id),
      ancestors: anc,
      descendants: desc,
      step: step,
      total: step + maxDown,
      nextUp: nextUp
    };
  }

  // A fingerprint of everything that affects any badge. When it changes,
  // the Power-Up redraws.
  function signature(b) {
    var ids = {};
    Object.keys(b.links).forEach(function (k) { ids[k] = 1; ids[b.links[k]] = 1; });
    var parts = Object.keys(ids).sort().map(function (id) {
      var c = b.cardsById[id];
      return id + ':' + (c ? c.name + '|' + (isDone(b, id) ? 1 : 0) : 'x');
    });
    return JSON.stringify(b.links) + '#' + parts.join(',');
  }

  function saveLink(t, cardId, prevId) {
    return t.get('board', 'shared', LINKS_KEY, {}).then(function (links) {
      links = links || {};
      if (prevId) links[cardId] = prevId; else delete links[cardId];
      if (JSON.stringify(links).length > 3800) {
        // Trello allows ~4 KB per board; drop links for cards no longer on the board.
        return t.cards('id').then(function (cards) {
          var live = {};
          cards.forEach(function (c) { live[c.id] = 1; });
          Object.keys(links).forEach(function (k) { if (!live[k]) delete links[k]; });
          if (JSON.stringify(links).length > 4000) {
            throw new Error('This board has too many linked tasks for Trello to store.');
          }
          return t.set('board', 'shared', LINKS_KEY, links);
        });
      }
      return t.set('board', 'shared', LINKS_KEY, links);
    });
  }

  // Move a link saved by version 1 (on the card) into the board map.
  function migrate(t) {
    return t.get('card', 'shared', OLD_CARD_KEY).then(function (old) {
      if (!old) return false;
      var cardId = t.getContext().card;
      return saveLink(t, cardId, old)
        .then(function () { return t.remove('card', 'shared', OLD_CARD_KEY); })
        .then(function () { return true; });
    }).catch(function () { return false; });
  }

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  return {
    ICONS: ICONS, load: load, isDone: isDone, name: name, listName: listName,
    ancestors: ancestors, descendants: descendants, info: info,
    signature: signature, saveLink: saveLink, migrate: migrate, truncate: truncate
  };
})();
