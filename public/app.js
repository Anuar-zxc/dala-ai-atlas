const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const locations = {
  'Актобе': [57.21, 50.28], 'Алматы': [76.89, 43.24], 'Астана': [71.43, 51.13],
  'Атырау': [51.88, 47.11], 'Актау': [51.17, 43.65], 'Караганда': [73.09, 49.8],
  'Костанай': [63.62, 53.21], 'Кокшетау': [69.38, 53.28], 'Кызылорда': [65.51, 44.85],
  'Павлодар': [76.95, 52.29], 'Рудный': [63.12, 52.97], 'Семей': [80.23, 50.41],
  'Талдыкорган': [78.37, 45.02], 'Тараз': [71.37, 42.9], 'Уральск': [51.37, 51.23],
  'Усть-Каменогорск': [82.61, 49.95], 'Шымкент': [69.6, 42.32],
};
const dialog = $('dialog');
const filterIds = ['query', 'sector', 'city', 'batch'];
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
  dialog.scrollTop = 0;
}

dialog.querySelector('.close').onclick = () => dialog.close();
dialog.addEventListener('click', event => {
  if (event.target === dialog && !dialog.matches(':hover')) dialog.close();
});

function profile(project) {
  const fields = [
    [project.role, project.team],
    ['Целевая аудитория', project.audience],
    ['Стадия / статус', project.stage],
    ['География', project.geo],
    ['Источники сверены', project.checked.split('-').reverse().join('.')],
  ];
  openPanel(logo(project) + '<h2 id="title">' + escape(project.name) + '</h2><p>' +
    escape(project.description) + '</p><span class="tag">' + escape(project.sector) +
    '</span><dl>' + fields.map(([label, value]) =>
      '<dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd>').join('') +
    '</dl><strong>Ссылки и источники</strong><div class="links">' +
    Object.entries(project.links).map(([label, url]) =>
      '<a target="_blank" rel="noopener noreferrer" href="' + escape(url) + '">' +
      escape(label) + ' ↗</a>').join('') + '</div>');
}

function groupKey(project) {
  if (project.city && locations[project.city]) return 'city:' + project.city;
  if (project.programCity && locations[project.programCity]) return 'program:' + project.programCity;
  return 'unknown';
}

function groupLabel(key) {
  if (key === 'all') return 'Все проекты';
  if (key === 'unknown') return 'Город не указан';
  const [kind, city] = key.split(':');
  return kind === 'program' ? 'nFactorial · ' + city : city;
}

function projectLocation(project) {
  if (project.city) return project.city;
  if (project.programCity) return 'nFactorial · ' + project.programCity;
  return 'Город не указан';
}

function renderCatalog() {
  const query = $('query').value.toLocaleLowerCase('ru').trim().split(/\s+/);
  const sector = $('sector').value;
  const city = $('city').value;
  const batch = $('batch').value;
  const filtered = projects.filter(project => {
    const text = [project.name, project.team, project.description, project.audience,
      project.sector, projectLocation(project)].join(' ').toLocaleLowerCase('ru');
    return query.every(word => text.includes(word)) &&
      (!sector || sector === project.sector) &&
      (!city || city === groupKey(project)) &&
      (!batch || (batch === 'independent' ? project.kind === 'company' : String(project.batch) === batch));
  });
  const offset = (currentPage - 1) * pageSize;
  $('cards').innerHTML = filtered.slice(offset, offset + pageSize).map(project =>
    '<button class="card" data-id="' + escape(project.id) + '"><span class="cardtop">' + logo(project) +
    '<span class="tag">' + escape(project.sector) + '</span></span><h3>' + escape(project.name) +
    '</h3><p>' + escape(project.description) + '</p><span class="cardfoot"><span>' +
    escape(project.batch ? 'nFactorial ' + project.batch : projectLocation(project)) +
    '</span><span aria-hidden="true">↗</span></span></button>').join('') ||
    '<p class="empty">Совпадений нет. Измените запрос или сбросьте фильтры.</p>';
  $('count').textContent = 'Найдено: ' + filtered.length + ' из ' + projects.length;
  $('reset').hidden = !filterIds.some(id => $(id).value);
  const pages = Math.ceil(filtered.length / pageSize);
  $('pages').innerHTML = pages > 1 ? '<button data-step="-1" ' +
    (currentPage === 1 ? 'disabled' : '') + '>← Назад</button><span>' + currentPage + ' / ' +
    pages + '</span><button data-step="1" ' + (currentPage === pages ? 'disabled' : '') +
    '>Дальше →</button>' : '';
}

function clearFilters() {
  for (const id of filterIds) $(id).value = '';
  currentPage = 1;
}

function showProjects(event) {
  const card = event.target.closest('[data-id]');
  if (card) profile(projects.find(project => project.id === card.dataset.id));
}

function selectMapGroup(key) {
  $('map-group').value = key;
  $('country-group').setAttribute('aria-pressed', String(key === 'unknown'));
  const entries = groups.get(key);
  $('map-list').innerHTML = entries.map(project =>
    '<button class="map-item" data-id="' + escape(project.id) + '">' + logo(project) +
    '<span><b>' + escape(project.name) + '</b><small>' +
    escape(project.batch ? 'nFactorial ' + project.batch + ' · ' + project.sector : project.sector) +
    '</small></span><span aria-hidden="true">↗</span></button>').join('');
  $('map-list').scrollTop = 0;
  for (const marker of $('pins').children) {
    marker.setAttribute('aria-pressed', String(marker.dataset.group === key));
  }
}

function addMarker(key, count) {
  if (key === 'all' || key === 'unknown') return;
  const [kind, city] = key.split(':');
  const [longitude, latitude] = locations[city];
  const x = 33 + (longitude - 46) * 14;
  const y = 35 + (56 - latitude) * 21;
  const marker = document.createElement('button');
  marker.className = 'pin ' + kind;
  marker.dataset.group = key;
  marker.dataset.city = city;
  marker.style.left = x / 650 * 100 + '%';
  marker.style.top = y / 380 * 100 + '%';
  marker.innerHTML = '<span>' + count + '</span><b>' +
    escape(kind === 'program' ? 'nFactorial' : city) + '</b>';
  marker.setAttribute('aria-label', groupLabel(key) + ', проектов: ' + count);
  marker.onclick = () => selectMapGroup(key);
  $('pins').append(marker);
}

$('reset').onclick = () => { clearFilters(); renderCatalog(); $('query').focus(); };
$('cards').onclick = showProjects;
$('map-list').onclick = showProjects;
$('map-group').onchange = event => selectMapGroup(event.target.value);
$('map-catalog').onclick = () => {
  const key = $('map-group').value;
  clearFilters();
  if (key !== 'all') $('city').value = key;
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
for (const id of filterIds) $(id).addEventListener('input', () => { currentPage = 1; renderCatalog(); });

function showAbout() {
  openPanel('<h2 id="title">О проекте</h2><p>Атлас объединяет ИИ-компании казахстанской экосистемы и проекты nFactorial Incubator. Выпуск инкубатора указан в каждой архивной карточке.</p><p>Яркие отметки показывают города, связанные с командами. Синяя отметка в Алматы показывает место проведения инкубатора. Для остальных компаний используйте пункт «Город не указан» в списке карты.</p><p>Описание отражает данные в источнике. Сведения о текущей работе архивных проектов могут отсутствовать. Целевая аудитория указана по назначению продукта.</p><p>Границы карты предоставлены Natural Earth. Заявки на новые проекты проходят редакторскую проверку.</p>');
}
$('about').onclick = showAbout;
$('about-footer').onclick = showAbout;
const inputs = [['name','Название стартапа',100],['url','Публичная ссылка на проект',350],['sector','Сфера',100],['team','Основатели и роли',350],['description','Что делает продукт и как использует ИИ?',1200],['audience','Для кого создан продукт?',400],['geo','Как проект связан с Казахстаном? Укажите город, если известен.',350],['stage','Стадия проекта',120]];
$('add').onclick=()=>{
  openPanel('<div class="eyebrow">DALA ATLAS</div><h2 id="title">Добавить стартап</h2><p>Расскажите о команде. После проверки по публичным источникам редактор добавит карточку в атлас.</p><form>'+inputs.map(([k,label,max])=>'<label>'+label+(k==='stage'?' (необязательно)':'')+(k==='description'?'<textarea rows="3"':'<input type="'+(k==='url'?'url':'text')+'"')+' name="'+k+'" maxlength="'+max+'" '+(k==='stage'?'':'required')+'>'+(k==='description'?'</textarea>':'')+'</label>').join('')+'<button class="submit">Отправить на проверку</button><p id="feedback" role="status"></p></form>');
  const form=$('content').querySelector('form');
  form.onsubmit=async e=>{
    e.preventDefault(); const btn=form.querySelector('button');btn.disabled=true; $('feedback').textContent='Сохранение…';
    try {
      const res=await fetch('/api/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
      if(!res.ok) throw Error(res.status===400?'Проверьте поля и публичную ссылку.':'Сохранение не удалось. Попробуйте ещё раз.');
      openPanel('<div class="eyebrow">ЗАЯВКА СОХРАНЕНА</div><h2 id="title">Спасибо за проект!</h2><p>Редактор проверит сведения перед публикацией.</p>');
    } catch(err) { $('feedback').textContent=err.message;btn.disabled=false; }
  };
};

async function init() {
  const response = await fetch('/startups.json');
  if (!response.ok) throw Error('Каталог недоступен');
  projects = await response.json();
  groups.set('all', projects);
  for (const project of projects) {
    const key = groupKey(project);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(project);
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
  $('batch').add(new Option('Компании и команды', 'independent'));
  const yearSet = new Set(projects.map(project => project.batch).filter(Boolean));
  for (const year of [...yearSet].sort((a, b) => b - a)) $('batch').add(new Option('nFactorial ' + year, year));
  const cityCount = new Set(mapKeys.filter(key => key !== 'unknown').map(key => key.split(':')[1])).size;
  $('stats').innerHTML = [
    [projects.length, 'проектов'], [cityCount, 'городов'], [yearSet.size, 'выпусков nFactorial'],
  ].map(([number, label]) => '<div><strong>' + number + '</strong><span>' + label + '</span></div>').join('');
  selectMapGroup('all');
  renderCatalog();
}

init().catch(() => {
  $('count').textContent = 'Не удалось загрузить каталог. Обновите страницу.';
  $('map-list').textContent = 'Данные временно недоступны.';
});
