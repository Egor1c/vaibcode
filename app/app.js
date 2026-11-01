(function () {
  'use strict';
  var catalog = [
    { key: 'youtube', name: 'YouTube', logo: 'YouTube', category: 'Видео и авторы', appId: 'youtube.leanback.v4' },
    { key: 'netflix', name: 'Netflix', logo: 'NETFLIX', category: 'Фильмы и сериалы', appId: 'netflix' },
    { key: 'kinopoisk', name: 'Кинопоиск', logo: 'кинопоиск', category: 'Кино на каждый вечер', appId: 'ru.kinopoisk' },
    { key: 'ivi', name: 'Иви', logo: 'ivi', category: 'Фильмы и премьеры', appId: 'ivi' },
    { key: 'okko', name: 'Okko', logo: 'okko', category: 'Кино, сериалы, спорт', appId: 'okko' },
    { key: 'wink', name: 'Wink', logo: 'wink', category: 'Кино и телевидение', appId: 'wink' },
    { key: 'start', name: 'START', logo: 'START', category: 'Оригинальные истории', appId: 'start' },
    { key: 'premier', name: 'PREMIER', logo: 'PREMIER', category: 'Сериалы и шоу', appId: 'premier' },
    { key: 'kion', name: 'KION', logo: 'KION', category: 'Кино и сериалы', appId: 'kion' },
    { key: 'more', name: 'more.tv', logo: 'more.tv', category: 'Если доступен на вашем ТВ', appId: 'more.tv' },
    { key: 'rutube', name: 'RUTUBE', logo: 'RUTUBE', category: 'Видео и трансляции', appId: 'rutube' },
    { key: 'vk', name: 'VK Видео', logo: 'VK Видео', category: 'Видео и шоу', appId: 'vkvideo' }
  ];
  var devices = [
    { name: 'ТВ-каналы', detail: 'Прямой эфир', icon: '▤', appId: 'com.webos.app.livetv' },
    { name: 'HDMI 1', detail: 'Внешнее устройство', icon: '▱', appId: 'com.webos.app.hdmi1' },
    { name: 'HDMI 2', detail: 'Внешнее устройство', icon: '▱', appId: 'com.webos.app.hdmi2' },
    { name: 'HDMI 3', detail: 'Если есть на вашем ТВ', icon: '▱', appId: 'com.webos.app.hdmi3' },
    { name: 'Настройки ТВ', detail: 'Изображение и звук', icon: '⚙', appId: 'com.palm.app.settings' }
  ];
  var storageKey = 'livingroom.settings.v1';
  var settings = {};
  try {
    var stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) settings = stored;
  } catch (e) { settings = {}; }
  var toastTimer;
  var pendingBridges = [];
  var dialog = document.getElementById('settings-dialog');
  var returnFocus;

  function notify(message) {
    var toast = document.getElementById('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 6500);
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); }
    catch (e) { notify('Не удалось сохранить настройки. Они действуют до закрытия приложения.'); }
  }
  function preference(service) {
    var value = Object.prototype.hasOwnProperty.call(settings, service.key) ? settings[service.key] : null;
    return value && typeof value === 'object' ? value : {};
  }
  function launch(appId, name, isService) {
    if (!window.PalmServiceBridge) {
      notify('Предпросмотр: «' + name + '» запускается только на телевизоре с webOS.');
      return;
    }
    if (!appId) { notify('Укажите ID приложения в настройках экрана.'); return; }
    var bridge = new window.PalmServiceBridge();
    pendingBridges.push(bridge);
    var finished = false;
    function finish(message) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      pendingBridges = pendingBridges.filter(function (item) { return item !== bridge; });
      if (message) notify(message);
    }
    var timeout = setTimeout(function () { finish('Телевизор не подтвердил запуск «' + name + '». Проверьте приложение и его ID.'); }, 10000);
    bridge.onservicecallback = function (raw) {
      var result;
      try { result = JSON.parse(raw); } catch (e) { finish('Не удалось прочитать ответ телевизора.'); return; }
      if (result.returnValue === true) { finish(); }
      else { finish(isService ? 'Не удалось открыть «' + name + '». Установите сервис из магазина ТВ и проверьте его ID в настройках экрана.' : '«' + name + '» недоступно. Проверьте наличие входа или приложения на телевизоре.'); }
    };
    try { bridge.call('luna://com.webos.applicationManager/launch', JSON.stringify({ id: appId })); }
    catch (e) { finish('Телевизор отклонил запрос запуска приложения.'); }
  }
  function renderServices() {
    var grid = document.getElementById('services');
    grid.textContent = '';
    catalog.forEach(function (service) {
      var pref = preference(service);
      if (pref.hidden === true) return;
      var button = document.createElement('button');
      button.className = 'service-card';
      button.dataset.service = service.key;
      button.setAttribute('aria-label', 'Открыть ' + service.name);
      var art = document.createElement('span');
      art.className = 'service-art ' + service.key;
      var logo = document.createElement('span');
      logo.className = 'service-logo';
      if (service.key === 'youtube') {
        var play = document.createElement('span');
        play.className = 'yt-play'; play.setAttribute('aria-hidden', 'true'); logo.appendChild(play);
      }
      logo.appendChild(document.createTextNode(service.logo));
      art.appendChild(logo); button.appendChild(art);
      var label = document.createElement('span'); label.className = 'service-label'; label.textContent = service.name; button.appendChild(label);
      var category = document.createElement('span'); category.className = 'service-category'; category.textContent = service.category; button.appendChild(category);
      button.addEventListener('click', function () {
        var savedId = preference(service).appId;
        launch(typeof savedId === 'string' ? savedId : service.appId, service.name, true);
      });
      grid.appendChild(button);
    });
    document.getElementById('empty-state').hidden = grid.children.length > 0;
  }
  function renderDevices() {
    var grid = document.getElementById('inputs');
    devices.forEach(function (device) {
      var button = document.createElement('button'); button.className = 'input-button';
      var icon = document.createElement('span'); icon.className = 'input-icon'; icon.textContent = device.icon; icon.setAttribute('aria-hidden', 'true');
      var title = document.createElement('span'); title.className = 'input-name'; title.textContent = device.name;
      var detail = document.createElement('span'); detail.className = 'input-detail'; detail.textContent = device.detail;
      title.appendChild(detail); button.appendChild(icon); button.appendChild(title);
      button.addEventListener('click', function () { launch(device.appId, device.name, false); }); grid.appendChild(button);
    });
  }
  function renderSettings() {
    var container = document.getElementById('service-settings'); container.textContent = '';
    catalog.forEach(function (service) {
      var row = document.createElement('div'); row.className = 'settings-row';
      var visible = document.createElement('input'); visible.type = 'checkbox'; visible.id = 'visible-' + service.key;
      visible.checked = preference(service).hidden !== true;
      visible.setAttribute('aria-label', 'Показывать ' + service.name);
      var label = document.createElement('label'); label.htmlFor = visible.id; label.textContent = service.name;
      var appId = document.createElement('input'); appId.className = 'app-id'; appId.type = 'text'; appId.maxLength = 150; appId.spellcheck = false;
      appId.setAttribute('aria-label', 'ID приложения ' + service.name);
      appId.value = typeof preference(service).appId === 'string' ? preference(service).appId : service.appId;
      function save() {
        settings[service.key] = { hidden: !visible.checked, appId: appId.value.trim() };
        persist(); renderServices();
      }
      visible.addEventListener('change', save); appId.addEventListener('change', save);
      row.appendChild(visible); row.appendChild(label); row.appendChild(appId); container.appendChild(row);
    });
  }
  function focusFirst(selector) {
    var target = document.querySelector(selector);
    if (target) target.focus(); else openSettings();
  }
  function openSettings() {
    returnFocus = document.activeElement;
    renderSettings(); dialog.showModal(); document.getElementById('close-settings').focus();
  }
  function closeSettings() { dialog.close(); if (returnFocus && returnFocus.isConnected) returnFocus.focus(); }
  function clock() {
    var now = new Date();
    document.getElementById('clock').textContent = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
  }
  function setTab(id) {
    document.querySelectorAll('.nav-button').forEach(function (item) { item.classList.toggle('active', item.id === id); });
  }
  document.getElementById('settings-button').addEventListener('click', openSettings);
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); closeSettings(); });
  document.getElementById('reset-settings').addEventListener('click', function () { settings = {}; persist(); renderServices(); renderSettings(); notify('Исходные настройки восстановлены.'); });
  document.getElementById('choose-service').addEventListener('click', function () { setTab('services-nav'); focusFirst('.service-card'); });
  document.getElementById('services-nav').addEventListener('click', function () { setTab('services-nav'); focusFirst('.service-card'); });
  document.getElementById('inputs-nav').addEventListener('click', function () { setTab('inputs-nav'); focusFirst('.input-button'); });
  function goHome() { setTab('home'); document.getElementById('choose-service').focus(); window.scrollTo(0, 0); }
  document.getElementById('home').addEventListener('click', goHome);
  document.querySelector('.brand').addEventListener('click', function (e) { e.preventDefault(); goHome(); });

  // Spatial focus navigation works with a standard D-pad, mouse and keyboard.
  document.addEventListener('keydown', function (event) {
    var key = event.key;
    if (event.keyCode === 461 || key === 'Escape' || key === 'BrowserBack') {
      event.preventDefault();
      if (dialog.open) { closeSettings(); return; }
      if (document.activeElement.id !== 'choose-service') { goHome(); return; }
      if (window.PalmSystem && typeof window.PalmSystem.platformBack === 'function') window.PalmSystem.platformBack();
      else notify('Вы на главном экране. На телевизоре используйте кнопку Home для выхода.');
      return;
    }
    if (key === 'Enter' && document.activeElement.type === 'checkbox') { event.preventDefault(); document.activeElement.click(); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(key) === -1) return;
    var active = document.activeElement;
    if (active.tagName === 'INPUT' && active.type === 'text' && (key === 'ArrowLeft' || key === 'ArrowRight')) return;
    event.preventDefault();
    var root = dialog.open ? dialog : document;
    var options = Array.prototype.slice.call(root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')).filter(function (el) { return el.getClientRects().length && !el.closest('[hidden]'); });
    if (!options.length) return;
    if (options.indexOf(active) === -1) { options[0].focus(); return; }
    var from = active.getBoundingClientRect(); var x = from.left + from.width / 2; var y = from.top + from.height / 2;
    var horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    var sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    var best = null; var bestScore = Infinity;
    options.forEach(function (candidate) {
      if (candidate === active) return;
      var rect = candidate.getBoundingClientRect();
      var dx = rect.left + rect.width / 2 - x; var dy = rect.top + rect.height / 2 - y;
      var forward = (horizontal ? dx : dy) * sign; var sideways = Math.abs(horizontal ? dy : dx);
      if (forward <= 4) return;
      var overlap = horizontal ? rect.top < from.bottom - 2 && rect.bottom > from.top + 2 : rect.left < from.right - 2 && rect.right > from.left + 2;
      var score = forward + sideways * 2.2 + (overlap ? 0 : 900);
      if (score < bestScore) { bestScore = score; best = candidate; }
    });
    if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  });
  renderServices(); renderDevices(); clock(); setInterval(clock, 15000);
  document.getElementById('choose-service').focus({ preventScroll: true });
}());
