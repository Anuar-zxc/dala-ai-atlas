import { locations, stages, stageOf, mergeCatalog } from './fields.js';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);


const dialog = $('dialog');
const filterIds = ['query', 'sector', 'city', 'stage', 'batch'];
const pageSize = 18;
let projects = [];
let groups = new Map();
let currentPage = 1;

function logo(project) {
  if (project.logo) {
    return '<img class="logo" loading="lazy" src="/' + escape(project.logo) + '" alt="">';
  }
  const initials = Array.from(project.name.trim()).slice(0, 2).join('').toLocaleUpperCase('ru');
  return '<span class="logo monogram" aria-hidden="true">' + escape(initials) + '</span>';
}

function openPanel(html) {
  $('content').innerHTML = html;
  if (!dialog.open) dialog.showModal();
  const title = $('title');
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
  dialog.scrollTop = 0;
}

dialog.querySelector('.close').onclick = () => dialog.close();
dialog.addEventListener('click', event => {
  if (event.target === dialog && !dialog.matches(':hover')) dialog.close();
});

function externalLink(label, url, className = '') {
  return '<a class="' + className + '" target="_blank" rel="noopener noreferrer" href="' +
    escape(url) + '">' + escape(label) + ' <span aria-hidden="true">↗</span></a>';
}

function profile(project) {
  const contacts = project.contacts || [];
  const channelList = contacts.length ? '<div class="contact-grid">' +
    contacts.map(({ label, url }) => externalLink(label, url, 'contact-link')).join('') + '</div>' :
    '<p class="contact-empty">Публичный контакт не указан. Ссылки проекта доступны в источниках.</p>';
  const fields = [
    [project.role, project.team],
    ['Целевая аудитория', project.audience],
    ['География', project.geo],
  ];
  openPanel('<div class="profile-heading">' + logo(project) + '<div><div class="eyebrow">' +
    escape(projectLocation(project)) + '</div><h2 id="title">' + escape(project.name) +
    '</h2></div></div><div class="profile-tags"><span class="tag">' + escape(project.sector) +
    '</span><span class="tag stage-tag">' + escape(project.stage) + '</span></div>' +
    '<section class="profile-section"><h3>О продукте</h3><p>' + escape(project.description) +
    '</p></section><dl>' + fields.map(([label, value]) =>
    '<dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd>').join('') + '</dl>' +
    '<section class="contact-section"><h3>Связаться с командой</h3>' + channelList + '</section>' +
    '<details class="profile-sources"><summary>Ссылки и источники</summary><div class="links">' +
    Object.entries(project.links).map(([label, url]) => externalLink(label, url)).join('') +
    '</div><small>Сверено ' + escape(project.checked.split('-').reverse().join('.')) +
    '</small></details><button type="button" class="bare profile-share" id="profile-share">Скопировать ссылку</button>' +
    '<span role="status" id="share-status"></span>');
  $('profile-share').onclick = async () => {
    const url = new URL('/', location.origin);
    url.searchParams.set('project', project.id);
    try {
      await navigator.clipboard.writeText(url.href);
      $('share-status').textContent = 'Ссылка скопирована.';
    } catch {
      $('share-status').textContent = url.href;
    }
  };
}

function projectCities(project) {
  const cities = [project.city || project.programCity, ...(project.alsoCities || [])];
  return [...new Set(cities.filter(city => Object.hasOwn(locations, city)))];
}

function groupLabel(key) {
  if (key === 'all') return 'Все проекты';
  if (key === 'unknown') return 'Город не указан';
  return key;
}

function projectLocation(project) {
  return projectCities(project).join(', ') || 'Город не указан';
}

function matchesQuery(project, query) {
  const text = [project.name, project.team, project.description, project.audience,
    project.sector, projectLocation(project), ...(project.aliases || [])].join(' ').toLocaleLowerCase('ru');
  return query.trim().toLocaleLowerCase('ru').split(/\s+/).every(word => text.includes(word));
}

function renderCatalog() {
  const query = $('query').value;
  const sector = $('sector').value;
  const city = $('city').value;
  const batch = $('batch').value;
  const stage = $('stage').value;
  const filtered = projects.filter(project => {
    return matchesQuery(project, query) &&
      (!sector || sector === project.sector) &&
      (!city || groups.get(city).includes(project)) &&
      (!stage || stage === stageOf(project)) &&
      (!$('contacts-only').checked || project.contacts?.length) &&
      (!batch || (batch === 'independent' ? project.kind === 'company' : String(project.batch) === batch));
  });
  const offset = (currentPage - 1) * pageSize;
  $('cards').innerHTML = filtered.slice(offset, offset + pageSize).map(project =>
    '<button class="card" data-id="' + escape(project.id) + '"><span class="cardtop">' + logo(project) +
    '<span class="tag">' + escape(project.sector) + '</span></span><h3>' + escape(project.name) +
    '</h3><p>' + escape(project.description) + '</p><span class="cardfoot"><span>' +
    escape([project.batch ? 'nFactorial ' + project.batch : projectLocation(project),
      stageOf(project) === 'mvp' ? 'MVP' : '', project.contacts?.length ? 'Контакт' : ''].filter(Boolean).join(' · ')) +
    '</span><span aria-hidden="true">↗</span></span></button>').join('') ||
    '<p class="empty">Совпадений нет. Измените запрос или сбросьте фильтры.</p>';
  $('count').textContent = 'Найдено: ' + filtered.length + ' из ' + projects.length;
  $('reset').hidden = !$('contacts-only').checked && !filterIds.some(id => $(id).value);
  const pages = Math.ceil(filtered.length / pageSize);
  $('pages').innerHTML = pages > 1 ? '<button data-step="-1" ' +
    (currentPage === 1 ? 'disabled' : '') + '>← Назад</button><span>' + currentPage + ' / ' +
    pages + '</span><button data-step="1" ' + (currentPage === pages ? 'disabled' : '') +
    '>Дальше →</button>' : '';
}

function clearFilters() {
  for (const id of filterIds) $(id).value = '';
  $('contacts-only').checked = false;
  currentPage = 1;
}

function showProjects(event) {
  const card = event.target.closest('[data-id]');
  if (card) profile(projects.find(project => project.id === card.dataset.id));
}

function selectMapGroup(key) {
  $('map-group').value = key;
  $('country-group').setAttribute('aria-pressed', String(key === 'unknown'));
  const query = $('map-search').value;
  const entries = groups.get(key).filter(project => matchesQuery(project, query));
  $('map-list').innerHTML = entries.map(project =>
    '<button class="map-item" data-id="' + escape(project.id) + '">' + logo(project) +
    '<span><b>' + escape(project.name) + '</b><small>' +
    escape((project.batch ? 'nFactorial ' + project.batch : projectLocation(project)) + ' · ' + project.sector) +
    '</small></span><span aria-hidden="true">↗</span></button>').join('') ||
    '<p class="map-empty">Совпадений нет.</p>';
  $('project-view-count').textContent = groupLabel(key) + ' · ' + entries.length;
  $('project-grid').innerHTML = entries.map(project =>
    '<button type="button" class="map-project" data-id="' + escape(project.id) +
    '" title="' + escape(project.name + ' · ' + projectLocation(project)) +
    '" aria-label="' + escape(project.name) + '">' + logo(project) + '</button>').join('');
  $('project-grid').scrollTop = 0;
  $('map-list').scrollTop = 0;
  for (const marker of $('pins').children) {
    marker.setAttribute('aria-pressed', String(marker.dataset.group === key));
  }
}

function addMarker(city, count) {
  if (city === 'all' || city === 'unknown') return;
  const [longitude, latitude] = locations[city];
  const x = 33 + (longitude - 46) * 14;
  const y = 35 + (56 - latitude) * 21;
  const marker = document.createElement('button');
  marker.className = 'pin';
  marker.dataset.group = city;
  marker.dataset.city = city;
  marker.style.left = x / 650 * 100 + '%';
  marker.style.top = y / 380 * 100 + '%';
  marker.innerHTML = '<span>' + count + '</span><b>' +
    escape(city) + '</b>';
  marker.setAttribute('aria-label', city + ', проектов: ' + count);
  marker.onclick = () => selectMapGroup(city);
  $('pins').append(marker);
}

$('reset').onclick = () => { clearFilters(); renderCatalog(); $('query').focus(); };
$('cards').onclick = showProjects;
$('map-list').onclick = showProjects;
$('project-grid').onclick = showProjects;
$('map-search').oninput = () => selectMapGroup($('map-group').value);
function setMapView(showProjects) {
  $('city-view').hidden = showProjects;
  $('project-view').hidden = !showProjects;
  $('view-cities').setAttribute('aria-pressed', String(!showProjects));
  $('view-projects').setAttribute('aria-pressed', String(showProjects));
}
$('view-cities').onclick = () => setMapView(false);
$('view-projects').onclick = () => {
  if (!groups.has('all')) return;
  selectMapGroup('all');
  setMapView(true);
};
$('map-group').onchange = event => selectMapGroup(event.target.value);
$('map-catalog').onclick = () => {
  const key = $('map-group').value;
  clearFilters();
  if (key !== 'all') $('city').value = key;
  $('query').value = $('map-search').value;
  renderCatalog();
  $('catalog').scrollIntoView();
  $('query').focus({preventScroll: true});
};
$('pages').onclick = event => {
  const step = event.target.closest('[data-step]');
  if (!step) return;
  currentPage += Number(step.dataset.step);
  renderCatalog();
  $('catalog').scrollIntoView();
  $('catalog-title').setAttribute('tabindex', '-1');
  $('catalog-title').focus({preventScroll: true});
};
for (const id of [...filterIds, 'contacts-only']) $(id).addEventListener('input', () => { currentPage = 1; renderCatalog(); });

const fields = [
  ['name', 'Название', 100, 'text'], ['url', 'Ссылка на MVP, продукт или демо', 350, 'url'],
  ['sector', 'Сфера', 100, 'text'], ['team', 'Основатели и роли', 350, 'text'],
  ['description', 'Что делает продукт и как он использует ИИ?', 1200, 'textarea'],
  ['audience', 'Для кого создан продукт?', 400, 'text'],
  ['geo', 'Связь с Казахстаном и её подтверждение', 350, 'text'],
];
const contactFields = [
  ['founderLinkedIn', 'LinkedIn основателя', 350, 'url'],
  ['companyLinkedIn', 'LinkedIn компании', 350, 'url'],
  ['contactUrl', 'Страница для связи', 350, 'url'],
  ['contactEmail', 'Рабочая почта', 150, 'email'],
];
const fieldInput = ([key, label, max, type], required) => '<label>' + escape(label) +
  (type === 'textarea' ? '<textarea rows="3"' : '<input type="' + type + '"') +
  ' name="' + key + '" maxlength="' + max + '"' + (required ? ' required' : '') + '>' +
  (type === 'textarea' ? '</textarea>' : '') + '</label>';

$('add').onclick = () => {
  const cities = Object.keys(locations).sort((a, b) => a.localeCompare(b, 'ru'));
  openPanel('<h2 id="title">Добавить стартап</h2><p>Можно отправить заявку с MVP. Редактор проверит описание, стадию и публичные ссылки.</p>' +
    '<form>' + fields.slice(0, 2).map(field => fieldInput(field, true)).join('') +
    '<div class="form-pair"><label>Стадия<select name="stageKey" required><option value="">Выберите стадию</option>' +
    Object.entries(stages).map(([key, label]) => '<option value="' + key + '">' + label + '</option>').join('') +
    '</select></label><label>Город<select name="city"><option value="">Город не указан</option>' +
    cities.map(city => '<option>' + escape(city) + '</option>').join('') + '</select></label></div>' +
    fields.slice(2).map(field => fieldInput(field, true)).join('') +
    '<details class="submission-contacts"><summary>Контакты команды · необязательно</summary>' +
    contactFields.map(field => fieldInput(field, false)).join('') + '</details>' +
    '<label class="contact-consent"><input type="checkbox" name="publicContacts" required>' +
    'Подтверждаю, что сведения и контакты можно опубликовать.</label>' +
    '<button class="submit">Отправить на проверку</button><p id="feedback" role="status"></p></form>');
  const form = $('content').querySelector('form');
  const feedback = $('feedback');
  form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    feedback.textContent = 'Отправляем заявку…';
    try {
      const data = Object.fromEntries(new FormData(form));
      data.publicContacts = data.publicContacts === 'on';
      const response = await fetch('/api/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(error.error || 'Заявка не сохранилась. Попробуйте ещё раз.');
      }
      if (dialog.open && form.isConnected) {
        openPanel('<h2 id="title">Заявка на проверке</h2><p>После проверки редактор сможет опубликовать карточку на карте.</p>');
      }
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
};

if (new URLSearchParams(location.search).get('action') === 'submit') $('add').click();

async function init() {
  const [response, updates] = await Promise.all([
    fetch('/startups.json'),
    fetch('/api/catalog').then(result => result.ok ? result.json() : {}).catch(() => ({})),
  ]);
  if (!response.ok) throw Error('Каталог недоступен');
  projects = mergeCatalog(await response.json(), updates);
  groups.set('all', projects);
  for (const project of projects) {
    const cities = projectCities(project);
    for (const key of cities.length ? cities : ['unknown']) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(project);
    }
  }
  const mapKeys = [...groups.keys()].filter(key => key !== 'all')
    .sort((a, b) => b === 'unknown' ? -1 :
      a === 'unknown' ? 1 : groupLabel(a).localeCompare(groupLabel(b), 'ru'));
  if (groups.has('unknown')) {
    const button = $('country-group');
    button.hidden = false;
    button.textContent = 'Без города · ' + groups.get('unknown').length;
    button.onclick = () => selectMapGroup('unknown');
  }
  $('map-group').options[0].text = 'Все проекты · ' + projects.length;
  for (const key of mapKeys) {
    const count = groups.get(key).length;
    $('map-group').add(new Option(groupLabel(key) + ' · ' + count, key));
    $('city').add(new Option(groupLabel(key), key));
    addMarker(key, count);
  }
  const sectors = [...new Set(projects.map(project => project.sector))].sort((a, b) => a.localeCompare(b, 'ru'));
  for (const sector of sectors) $('sector').add(new Option(sector, sector));
  for (const [key, label] of Object.entries(stages)) $('stage').add(new Option(label, key));
  $('batch').add(new Option('Компании и команды', 'independent'));
  const yearSet = new Set(projects.map(project => project.batch).filter(Boolean));
  for (const year of [...yearSet].sort((a, b) => b - a)) $('batch').add(new Option('nFactorial ' + year, year));
  const cityCount = mapKeys.filter(key => key !== 'unknown').length;
  $('stats').innerHTML = [
    [projects.length, 'проектов'], [cityCount, 'городов'], [yearSet.size, 'выпусков nFactorial'],
  ].map(([number, label]) => '<div><strong>' + number + '</strong><span>' + label + '</span></div>').join('');
  selectMapGroup('all');
  renderCatalog();
  const sharedId = new URLSearchParams(location.search).get('project');
  const shared = projects.find(project => project.id === sharedId);
  if (shared) profile(shared);
}

init().catch(() => {
  $('count').textContent = 'Не удалось загрузить каталог. Обновите страницу.';
  $('map-list').textContent = 'Данные временно недоступны.';
});
