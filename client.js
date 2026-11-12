/* global TrelloPowerUp */
'use strict';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

// A previous task counts as complete when it sits in a list with one of these
// names (case-insensitive), when its due date is marked complete, or when it
// has been archived / removed from the board.
var DONE_LIST_NAMES = ['done', 'complete', 'completed', 'finished', 'shipped', 'archived'];

// How often (seconds) badges re-check status while the board is open.
var REFRESH_SECONDS = 10;

// Key used to store the link on each card (shared = visible to all members).
var KEY = 'prevTaskId';

var ICON = new URL('./icon.svg', window.location.href).toString();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDoneList(list) {
  return !!list && DONE_LIST_NAMES.indexOf(String(list.name).trim().toLowerCase()) !== -1;
}

// Load everything we need about the board in one go.
function loadBoard(t) {
  return Promise.all([
    t.cards('id', 'name', 'idList', 'closed', 'dueComplete'),
    t.lists('id', 'name')
  ]).then(function (res) {
    var cardsById = {};
    res[0].forEach(function (c) { cardsById[c.id] = c; });
    var listsById = {};
    res[1].forEach(function (l) { listsById[l.id] = l; });
    return { cards: res[0], cardsById: cardsById, listsById: listsById };
  });
}

// Work out the status of the current card's previous task.
// Returns null if the card has no previous task.
function getStatus(t) {
  return t.get('card', 'shared', KEY).then(function (prevId) {
    if (!prevId) return null;
    return loadBoard(t).then(function (board) {
      var prev = board.cardsById[prevId];
      if (!prev) {
        // Not among the board's open cards: archived, deleted or moved away.
        return { prevId: prevId, name: 'previous task (archived/removed)', done: true };
      }
      var done = !!prev.closed || !!prev.dueComplete || isDoneList(board.listsById[prev.idList]);
      return { prevId: prevId, name: prev.name, done: done };
    });
  });
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// Walk the chain backwards from startId. Returns true if it reaches targetId,
// meaning that linking target -> start would create a loop.
function chainReaches(t, startId, targetId, board) {
  var seen = {};
  function step(id) {
    if (!id || seen[id]) return Promise.resolve(false);
    if (id === targetId) return Promise.resolve(true);
    seen[id] = true;
    if (!board.cardsById[id]) return Promise.resolve(false);
    return t.get(id, 'shared', KEY).then(step, function () { return false; });
  }
  return step(startId);
}

// ---------------------------------------------------------------------------
// Popup: choose the previous task
// ---------------------------------------------------------------------------

function openPicker(t) {
  var me = t.getContext().card;
  return Promise.all([loadBoard(t), t.get('card', 'shared', KEY)]).then(function (res) {
    var board = res[0];
    var currentPrev = res[1];

    var candidates = board.cards.filter(function (c) { return c.id !== me; });

    var items = [];
    if (currentPrev) {
      items.push({
        text: '✕ Clear previous task',
        callback: function (t2) {
          return t2.remove('card', 'shared', KEY).then(function () { return t2.closePopup(); });
        }
      });
    }

    candidates.forEach(function (c) {
      var list = board.listsById[c.idList];
      items.push({
        text: (c.id === currentPrev ? '✓ ' : '') + c.name + (list ? '  ·  ' + list.name : ''),
        callback: function (t2) {
          return chainReaches(t2, c.id, me, board).then(function (loop) {
            if (loop) {
              return t2.alert({
                message: 'That would create a loop: "' + truncate(c.name, 40) + '" already waits on this card.',
                duration: 6,
                display: 'error'
              });
            }
            return t2.set('card', 'shared', KEY, c.id).then(function () { return t2.closePopup(); });
          });
        }
      });
    });

    if (!candidates.length) {
      items.push({ text: 'No other cards on this board yet.' });
    }

    return t.popup({
      title: 'Previous task (must finish first)',
      items: items,
      search: {
        count: 10,
        placeholder: 'Search cards…',
        empty: 'No matching cards'
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Power-Up capabilities
// ---------------------------------------------------------------------------

TrelloPowerUp.initialize({
  'card-buttons': function () {
    return [{
      icon: ICON,
      text: 'Previous task',
      callback: openPicker
    }];
  },

  // Badges on the front of the card (board view).
  'card-badges': function (t) {
    return t.get('card', 'shared', KEY).then(function (prevId) {
      if (!prevId) return [];
      return [{
        dynamic: function () {
          return getStatus(t).then(function (s) {
            if (!s) return { text: '', refresh: REFRESH_SECONDS };
            return s.done
              ? { text: 'Ready', color: 'green', icon: ICON, refresh: REFRESH_SECONDS }
              : { text: 'Blocked by: ' + truncate(s.name, 25), color: 'red', icon: ICON, refresh: REFRESH_SECONDS };
          });
        }
      }];
    });
  },

  // Badges inside the opened card.
  'card-detail-badges': function (t) {
    return t.get('card', 'shared', KEY).then(function (prevId) {
      if (!prevId) return [];
      return [{
        dynamic: function () {
          return getStatus(t).then(function (s) {
            if (!s) return { title: 'Previous task', text: 'None', callback: openPicker, refresh: REFRESH_SECONDS };
            return {
              title: s.done ? 'Previous task done' : 'Blocked by',
              text: truncate(s.name, 40),
              color: s.done ? 'green' : 'red',
              callback: openPicker,
              refresh: REFRESH_SECONDS
            };
          });
        }
      }];
    });
  }
});
