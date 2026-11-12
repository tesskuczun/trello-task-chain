/* global TrelloPowerUp, TC */
'use strict';

// How often (ms) the Power-Up checks the board for finished tasks.
var WATCH_MS = 1500;

// ---------------------------------------------------------------------------
// Watcher: notices when a task is finished (moved to Done, ticked, archived)
// and makes Trello redraw every badge straight away.
// ---------------------------------------------------------------------------

var watchT = null;
var lastSig = null;
var watching = false;

function watch(t) {
  watchT = t;
  if (watching) return;
  watching = true;
  setInterval(function () {
    if (!watchT) return;
    TC.load(watchT).then(function (b) {
      var sig = TC.signature(b);
      if (lastSig !== null && sig !== lastSig) {
        // Changing Power-Up data makes Trello redraw all badges and sections.
        watchT.set('board', 'private', 'tick', Date.now()).catch(function () {});
      }
      lastSig = sig;
    }).catch(function () {});
  }, WATCH_MS);
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function frontBadges(b, id) {
  var i = TC.info(b, id);
  if (!i.inChain) return [];
  var out = [];
  if (i.total > 1) out.push({ text: 'Step ' + i.step + ' of ' + i.total });
  if (i.done) return out;
  if (i.prev) {
    out.push(i.blocked
      ? { text: 'Blocked by: ' + TC.truncate(TC.name(b, i.prev), 25), color: 'red', icon: TC.ICONS.lock }
      : { text: 'Ready', color: 'green', icon: TC.ICONS.check });
  } else {
    var n = i.descendants.length;
    out.push({ text: n + (n === 1 ? ' task waits' : ' tasks wait') + ' on this', color: 'orange', icon: TC.ICONS.flag });
  }
  return out;
}

function detailBadges(b, id) {
  var i = TC.info(b, id);
  if (!i.inChain) return [];
  if (i.prev) {
    // Every unfinished task before this one, numbered in the order to do them.
    var blockers = i.ancestors.filter(function (a) { return !TC.isDone(b, a); });
    if (i.done || !blockers.length) {
      return [{
        title: i.done ? 'Previous task' : 'Ready',
        text: i.done ? TC.truncate(TC.name(b, i.prev), 40) : 'All earlier tasks are done',
        color: i.done ? null : 'green',
        icon: TC.ICONS.check,
        callback: openPicker
      }];
    }
    return blockers.map(function (a, n) {
      return {
        title: n === 0 ? 'Blocked by' : ' ',
        text: (n + 1) + '. ' + TC.truncate(TC.name(b, a), 40),
        color: 'red',
        icon: TC.ICONS.lock,
        callback: function (t2) { return t2.showCard(a); }
      };
    });
  }
  var n = i.descendants.length;
  return [{
    title: 'First task',
    text: n + (n === 1 ? ' task waits' : ' tasks wait') + ' on this',
    color: i.done ? null : 'orange',
    icon: TC.ICONS.flag,
    callback: openPicker
  }];
}

// Each badge re-checks itself every 10 s as a backup to the watcher.
function dynamicList(t, build) {
  var id = t.getContext().card;
  watch(t);
  return TC.migrate(t).then(function () { return TC.load(t); }).then(function (b) {
    var first = build(b, id);
    return first.map(function (badge, idx) {
      return {
        dynamic: function () {
          return TC.load(t).then(function (b2) {
            var now = build(b2, id)[idx] || { text: '' };
            now.refresh = 10;
            return now;
          });
        }
      };
    });
  });
}

// ---------------------------------------------------------------------------
// Popup: choose the previous task
// ---------------------------------------------------------------------------

function openPicker(t) {
  var me = t.getContext().card;
  return TC.load(t).then(function (b) {
    var currentPrev = b.links[me];
    var items = [];

    if (currentPrev) {
      items.push({
        text: '✕ Clear previous task',
        callback: function (t2) {
          return TC.saveLink(t2, me, null).then(function () { return t2.closePopup(); });
        }
      });
    }

    b.cards.filter(function (c) { return c.id !== me; }).forEach(function (c) {
      var list = TC.listName(b, c.id);
      items.push({
        text: (c.id === currentPrev ? '✓ ' : '') + c.name + (list ? '  ·  ' + list : ''),
        callback: function (t2) {
          // Refuse links that would make a loop.
          if (c.id === me || TC.ancestors(b, c.id).indexOf(me) !== -1) {
            return t2.alert({
              message: 'That would make a loop: "' + TC.truncate(c.name, 40) + '" already waits on this card.',
              duration: 6, display: 'error'
            });
          }
          return TC.saveLink(t2, me, c.id).then(function () { return t2.closePopup(); }, function (e) {
            return t2.alert({ message: e.message, duration: 6, display: 'error' });
          });
        }
      });
    });

    if (items.length === (currentPrev ? 1 : 0)) items.push({ text: 'No other cards on this board yet.' });

    return t.popup({
      title: 'Previous task (must finish first)',
      items: items,
      search: { count: 10, placeholder: 'Search cards…', empty: 'No matching cards' }
    });
  });
}

// ---------------------------------------------------------------------------
// Power-Up capabilities
// ---------------------------------------------------------------------------

TrelloPowerUp.initialize({
  'card-buttons': function (t) {
    watch(t);
    return [{ icon: TC.ICONS.chain, text: 'Previous task', callback: openPicker }];
  },

  'card-badges': function (t) { return dynamicList(t, frontBadges); },

  'card-detail-badges': function (t) { return dynamicList(t, detailBadges); },

  // Section inside an open card listing the tasks that wait on this one.
  // (Tasks that must happen first are listed at the top under "Blocked by".)
  'card-back-section': function (t) {
    watch(t);
    return TC.load(t).then(function (b) {
      if (!TC.info(b, t.getContext().card).descendants.length) return;
      return {
        title: 'Tasks waiting on this one',
        icon: TC.ICONS.chain,
        content: { type: 'iframe', url: t.signUrl('./section.html'), height: 140 }
      };
    });
  }
});
