/* Point the Google Translate links at the current page (progressive enhancement).
   Without JS they default to the homepage, which still works. */
(function () {
  try {
    var host = 'tourdefrancelancashire-co-uk.translate.goog';
    var path = location.pathname || '/';
    var links = document.querySelectorAll('a[data-tl]');
    for (var i = 0; i < links.length; i++) {
      var tl = links[i].getAttribute('data-tl');
      links[i].href = 'https://' + host + path + '?_x_tr_sl=en&_x_tr_tl=' + tl + '&_x_tr_hl=en';
    }
  } catch (e) {}
})();
