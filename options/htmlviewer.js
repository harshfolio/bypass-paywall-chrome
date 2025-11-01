
if (window.location.href === 'https://codebeautify.org/htmlviewer') {
  let htmlviewer = document.querySelector('head > link[rel="canonical"][href="https://codebeautify.org/htmlviewer"]');
  if (!htmlviewer) {
    let ads = 'div.OUTBRAIN, div[id^="taboola-"], div.ad-container, div[class*="-ad-container"], div[class*="_ad-container"], div.arc_ad, div[id^="adv-"], div[class^="ad-"], div[class^="ad_"], div[class^="advert"], aside.ad';
    hideDOMStyle(ads, 10);
    let cookie_consent = 'div#didomi-host, div#onetrust-consent-sdk, div[id^="sp_message_container"], div#CybotCookiebotDialog, div#usercentrics-root, div.cmp-root-container';
    hideDOMStyle(cookie_consent, 11);
    let cybot_fade = document.querySelector('div#CybotCookiebotDialogBodyUnderlay');
    if (cybot_fade)
      cybot_fade.remove();
    let html_noscroll = ['cmp-modal-open', 'sp-message-open'];
    for (let elem of html_noscroll) {
      let noscroll = document.querySelector('html[class~="' + elem + '"]');
      if (noscroll)
        noscroll.classList.remove(elem);
    }
    let body_noscroll = ['no-scroll', 'overflowHidden'];
    for (let elem of body_noscroll) {
      let noscroll = document.querySelector('body[class~="' + elem + '"]');
      if (noscroll)
        noscroll.classList.remove(elem);
    }
    let overflow_hidden = document.querySelector('body[style*="overflow: hidden;"]');
    if (overflow_hidden)
      overflow_hidden.style.overflow = 'auto';

    unhideDataImages()    
    let hide;
    let canonical = document.querySelector('head > link[rel="canonical"][href], link[rel="canonical"][href]');
    if (canonical) {
      let canonical_url = canonical.href;
      let hostname = urlHost(canonical_url);
      correctLinks(hostname);
      unhideHostImages(hostname);

      if (hostname.endsWith('.ch')) {
        if (matchUrlDomain('hochparterre.ch', canonical_url)) {
          hide = 'header';
        } else if (document.querySelector('div#__next > div.page-section li > a[href^="https://jobs.tamedia.ch/"]')) { // ###_ch_tamedia
          hide = 'div[class*="FullHeader"], div[class^="Flyout_root"], footer, svg';
        }
      } else if (hostname.endsWith('.de')) {      
        if (matchUrlDomain('augsburger-allgemeine.de', canonical_url)) {
          hide = 'div.pt_onlinestory';
        } else if (matchUrlDomain('mainpost.de', canonical_url)) {
          hide = 'section.header-elements, nav, div.aa-first-layer';
        } else if (matchUrlDomain('nordsee-zeitung.de', canonical_url)) {
          hide = 'header.WcmsHeader';
        } else if (matchUrlDomain(['noz.de', 'shz.de'], canonical_url)) {
          hide = 'header, svg';
        } else if (matchUrlDomain(['volksstimme.de', 'mz.de'], canonical_url)) {
          hide = 'header, footer';
        }
      } else {
        if (matchUrlDomain(['businesslive.co.za', 'timeslive.co.za'], canonical_url)) {
          hide = 'div.nav-wrapper';
        } else if (matchUrlDomain('investorschronicle.co.uk', canonical_url)) {
          hide = 'div#specialist__renderer--header';
        } else if (matchUrlDomain('nouvelobs.com', canonical_url)) {
          hide = 'header, div.article__share, div.paywall, aside.sidecol, div.pre_footer, footer';
        } else if (matchUrlDomain('repubblica.it', canonical_url)) {
          hide = 'div.cookiewall, div[data-src^="//box.kataweb.it/"]';
        }
      }
    } else {
      if (document.querySelector('head > link[as="image"][imagesrcset^="https://photos.watchmedier.dk/"]')) {// ###_dk_watch_media
        hide = 'header, img, svg';
      }
    }
    if (hide)
      hideDOMStyle(hide);
  }
}

function matchDomain(domains, hostname = window.location.hostname) {
  let matched_domain = false;
  if (typeof domains === 'string')
    domains = [domains];
  domains.some(domain => (hostname === domain || hostname.endsWith('.' + domain)) && (matched_domain = domain));
  return matched_domain;
}

function urlHost(url) {
  if (/^http/.test(url)) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      console.log(`url not valid: ${url} error: ${e}`);
    }
  }
  return url;
}

function matchUrlDomain(domains, url) {
  return matchDomain(domains, urlHost(url));
}

function hideDOMStyle(selector, id = 1) {
  let style = document.querySelector('head > style#ext'+ id);
  if (!style && document.head) {
    let sheet = document.createElement('style');
    sheet.id = 'ext' + id;
    sheet.innerText = selector + ' {display: none !important;}';
    document.head.appendChild(sheet);
  }
}

function correctLinks(hostname) {
  let links = document.querySelectorAll('a[href^="/"]');
  for (let elem of links)
    elem.href = elem.href.replace('codebeautify.org', hostname);
}

function unhideHostImages(hostname) {
  let hidden_images = document.querySelectorAll('img[src^="/"]');
  for (let elem of hidden_images) {
    elem.src = elem.src.replace('codebeautify.org', hostname);
    elem.removeAttribute('srcset');
    let sources = elem.parentNode.querySelectorAll('source[srcset]');
    for (let source of sources)
      source.removeAttribute('srcset');
  }
}

function unhideDataImages() {
  let hidden_images = document.querySelectorAll('img[src^="data:image/"]');
  for (let elem of hidden_images) {
    if (elem.getAttribute('data-src'))
      elem.src = elem.getAttribute('data-src');
    else if (elem.parentNode) {
      let source = elem.parentNode.querySelector('source[data-srcset]');
      if (source) {
        elem.src = source.getAttribute('data-srcset').split(/[\?\s]/)[0];
      }
    }
  }
}
