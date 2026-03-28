(function(){
  var endpoint='https://api.goatcounter.com/count';
  function withRef(url){
    try {
      var u=new URL(url, location.href);
      var sp=u.searchParams;
      if(!sp.get('ref')) {
        var ref = new URLSearchParams(location.search).get('ref') || document.referrer || 'direct';
        sp.set('ref', ref);
      }
      if(!sp.get('variant')) {
        var variant = document.documentElement.getAttribute('data-experiment-variant') || 'unknown';
        sp.set('variant', variant);
      }
      u.search = sp.toString();
      return u.pathname + (u.search ? '?' + u.search : '') + (u.hash || '');
    } catch(e) { return url; }
  }
  function count(path, title, event){
    var payload={
      v:1,
      no_onload:1,
      referrer: document.referrer || '',
      path:path,
      title:title || document.title,
      event: !!event
    };
    var body = new URLSearchParams(payload).toString();
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], {type:'application/x-www-form-urlencoded'}));
    } else {
      fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body,keepalive:true}).catch(function(){});
    }
  }
  count(withRef(location.pathname + location.search + location.hash), document.title, false);
  document.addEventListener('click', function(e){
    var a=e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    var href=a.getAttribute('href');
    if(!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    count(withRef(href), 'outbound:'+href, true);
  }, true);
})();
