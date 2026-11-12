/* global TrelloPowerUp, TC */
'use strict';

var t = TrelloPowerUp.iframe();
var me = t.getContext().card;
if (t.getContext().theme === 'dark') document.body.classList.add('dark');

var ICON = {
  lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  target: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  flag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h11l-2 4 2 4H5"/></svg>'
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function row(cls, num, id, nameText, status) {
  return '<div class="row ' + cls + '">' +
    '<span class="num">' + num + '</span>' +
    '<span class="name" data-id="' + esc(id) + '" title="' + esc(nameText) + '">' + esc(nameText) + '</span>' +
    '<span class="status">' + status + '</span></div>';
}

function render() {
  return TC.load(t).then(function (b) {
    var i = TC.info(b, me);
    var html = '';

    // The task this card is (the goal), on top.
    var goalTag = i.done ? 'Done' : (i.blocked ? ICON.lock + ' Blocked' : (i.prev ? 'Ready' : ''));
    html += '<div class="goal">' + ICON.target + '<span>' + esc(TC.name(b, me)) + '</span>' +
      '<span class="tag">Step ' + i.step + ' of ' + i.total + (goalTag ? ' · ' + goalTag : '') + '</span></div>';

    // Everything that must happen first, numbered in order, stacked underneath.
    if (i.ancestors.length) {
      html += '<div class="label">Do these first, in order:</div><div class="stack">';
      i.ancestors.forEach(function (id, n) {
        var done = TC.isDone(b, id);
        var isNext = id === i.nextUp;
        var cls = done ? 'done' : (isNext ? 'next' : 'wait');
        var num = done ? ICON.check : String(n + 1);
        var status = done ? 'Done' : (isNext ? 'Do this next' : ICON.lock + ' Waiting');
        html += row(cls, num, id, TC.name(b, id), status);
      });
      html += '</div>';
    }

    // Tasks that wait on this one.
    if (i.descendants.length) {
      var n = i.descendants.length;
      html += '<div class="label flag">' + ICON.flag + ' ' + n + (n === 1 ? ' task waits' : ' tasks wait') +
        ' on this one, in this order:</div><div class="stack">';
      i.descendants.forEach(function (d) {
        var done = TC.isDone(b, d.id);
        html += row(done ? 'done' : 'after', done ? ICON.check : String(i.step + d.depth), d.id,
          TC.name(b, d.id), done ? 'Done' : '');
      });
      html += '</div>';
    }

    var root = document.getElementById('root');
    if (root.innerHTML !== html) {
      root.innerHTML = html;
      return t.sizeTo('#root');
    }
  }).catch(function () {});
}

document.addEventListener('click', function (e) {
  var el = e.target.closest('.name');
  if (el) t.showCard(el.getAttribute('data-id'));
});

t.render(render);
setInterval(render, 1500);
