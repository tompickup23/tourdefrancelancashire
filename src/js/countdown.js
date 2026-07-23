/* Countdown to Stage 2: Saturday 3 July 2027, roll-out ~11:00 BST. */
(function () {
  var el = document.getElementById('countdown');
  if (!el) return;
  var target = new Date('2027-07-03T11:00:00+01:00').getTime();
  var units = [
    ['days', 86400000],
    ['hours', 3600000],
    ['mins', 60000],
    ['secs', 1000]
  ];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    var diff = target - Date.now();
    if (diff < 0) diff = 0;
    var html = '';
    for (var i = 0; i < units.length; i++) {
      var v = Math.floor(diff / units[i][1]);
      diff -= v * units[i][1];
      html += '<div class="cd-unit"><b>' + (units[i][0] === 'days' ? v : pad(v)) + '</b><span>' + units[i][0] + '</span></div>';
    }
    el.innerHTML = html;
  }
  tick();
  setInterval(tick, 1000);
})();
