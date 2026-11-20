import { locations, stages, stageOf } from './fields.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const cities = Object.keys(locations).sort((a, b) => a.localeCompare(b, 'ru'));
const statusNames = { pending: 'На проверке', published: 'Опубликован', rejected: 'Отклонён', hidden: 'Скрыт' };
let baseline = [];
let changes = {};
let reviews = {};
let submissions = [];
let revision = null;
let next = null;
let tab = 'pending';
let selected = null;

async function request(body, cursor) {
  const url = '/api/admin' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '');
  const response = await fetch(url, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Запрос не выполнен.'), { status: response.status });
  return data;
}

function announce(message, error = false) {
  $('status').textContent = message;
  $('status').dataset.error = error;
}

function catalog() {
  const records = new Map(baseline.map(record => [record.id, { project: record, hidden: false }]));
  for (const [id, change] of Object.entries(changes)) records.set(id, change);
  return [...records.values()];
}

function rows() {
  if (tab === 'catalog') return catalog().map(({ project, hidden }) => ({
    id: project.id, name: project.name, team: project.team, city: project.city,
    status: hidden ? 'hidden' : 'published', project,
  }));
  return submissions.map(submission => {
    const { id: submissionId, entry, receivedAt } = submission;
    const id = 'submission-' + submissionId;
    return { id, submissionId, receivedAt, name: entry.name, city: entry.city,
      team: entry.team, status: reviews[submissionId] || 'pending', raw: entry,
      project: changes[id]?.project };
  }).filter(record => tab === 'pending' ? record.status === 'pending' : record.status !== 'pending');
}

function render() {
  const query = $('admin-search').value.toLocaleLowerCase('ru').trim();
  const list = rows().filter(record =>
    [record.name, record.team, record.city].join(' ').toLocaleLowerCase('ru').includes(query));
  $('records').innerHTML = list.map(record =>
    '<button class="record" type="button" data-id="' + escape(record.id) + '" aria-pressed="' +
    (selected?.id === record.id) + '"><b>' + escape(record.name) + '</b><small>' +
    escape([statusNames[record.status], record.city].filter(Boolean).join(' · ')) +
    '</small></button>').join('') || '<p>Подходящих записей нет.</p>';
  $('pending-count').textContent = submissions.filter(item => !reviews[item.id]).length + (next ? '+' : '');
  $('catalog-count').textContent = catalog().filter(item => !item.hidden).length;
  $('more').hidden = tab === 'catalog' || !next;
  for (const button of document.querySelectorAll('[data-tab]')) {
    button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
  }
}

function resetDetail() {
  selected = null;
  $('detail').innerHTML = '<h2>Выберите проект</h2><p>Откройте заявку или карточку из каталога.</p>';
}

async function load(append = false) {
  const data = await request(null, append ? next : undefined);
  submissions = append ? [...new Map([...submissions, ...data.submissions]
    .map(record => [record.id, record])).values()] : data.submissions;
  submissions.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
  next = data.next;
  changes = data.changes;
  reviews = data.reviews;
  revision = data.revision;
  $('login').hidden = true;
  $('workspace').hidden = false;
  $('logout').hidden = false;
  render();
}

function showLogin() {
  $('workspace').hidden = true;
  $('login').hidden = false;
  $('logout').hidden = true;
  $('login').querySelector('input').focus();
}

function select(name, label, options, value) {
  return '<label>' + label + '<select name="' + name + '">' + Object.entries(options).map(([key, text]) =>
    '<option value="' + escape(key) + '"' + (key === value ? ' selected' : '') + '>' +
      escape(text) + '</option>').join('') + '</select></label>';
}

function field(name, label, value, { max, wide = false, multiline = false, optional = false, type = 'text' } = {}) {
  const attributes = ' name="' + name + '" maxlength="' + max + '"' + (optional ? '' : ' required');
  return '<label' + (wide ? ' class="wide"' : '') + '>' + label + (multiline ?
    '<textarea rows="3"' + attributes + '>' + escape(value) + '</textarea>' :
    '<input type="' + type + '"' + attributes + ' value="' + escape(value) + '">') + '</label>';
}

function draftContacts(entry) {
  return [
    ['Основатель · LinkedIn', entry.founderLinkedIn], ['Компания · LinkedIn', entry.companyLinkedIn],
    ['Связаться с командой', entry.contactUrl], ['Рабочая почта', entry.contactEmail && 'mailto:' + entry.contactEmail],
  ].filter(([, url]) => url).map(([label, url]) => ({ label, url }));
}

function openEditor(record) {
  selected = record;
  const openedRevision = revision;
  const project = record.project || record.raw || {};
  const contacts = project.contacts || draftContacts(project);
  const source = project.links?.['Публичный источник'] || record.raw?.url || '';
  const sourceLinks = Object.entries(project.links || {}).filter(([label]) => label !== 'Публичный источник');
  const cityOptions = Object.fromEntries([['', 'Город не указан'], ...cities.map(city => [city, city])]);
  $('detail').innerHTML = '<span class="state">' + escape(statusNames[record.status] || 'Новая карточка') +
    '</span><h2 tabindex="-1">' + escape(project.name || 'Новая карточка') + '</h2>' +
    (sourceLinks.length ? '<div class="source-links">' + sourceLinks.map(([label, url]) =>
      '<a href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + escape(label) +
      ' ↗</a>').join('') + '</div>' : '') +
    '<form id="edit-form"><div class="editor-fields">' +
    field('name', 'Название', project.name, { max: 100 }) +
    field('sector', 'Сфера', project.sector, { max: 100 }) +
    select('city', 'Город команды', cityOptions, project.city || '') +
    select('stageKey', 'Стадия для фильтра', stages, stageOf(project)) +
    field('stage', 'Публичный статус или раунд', project.stage, { max: 120, optional: true }) +
    field('role', 'Роли команды', project.role, { max: 100, optional: true }) +
    field('team', 'Имена и роли', project.team, { max: 350, wide: true }) +
    field('description', 'Описание и роль ИИ', project.description, { max: 1200, wide: true, multiline: true }) +
    field('audience', 'Целевая аудитория', project.audience, { max: 400, wide: true }) +
    field('geo', 'Подтверждение связи с Казахстаном', project.geo, { max: 350, wide: true, multiline: true }) +
    field('url', 'Публичный источник', source, { max: 350, wide: true, optional: !!sourceLinks.length, type: 'url' }) +
    field('contacts', 'Публичные контакты · одна строка «Название | ссылка»', contacts
      .map(({ label, url }) => label + ' | ' + url).join('\n'),
      { max: 4000, wide: true, optional: true, multiline: true }) +
    '</div><div class="editor-actions"><button class="submit" type="submit">' +
    (record.status === 'published' ? 'Сохранить и опубликовать' : 'Опубликовать') + '</button>' +
    (record.submissionId && record.status === 'pending' ?
      '<button class="secondary" type="button" data-action="reject">Отклонить заявку</button>' : '') +
    (record.submissionId && record.status !== 'pending' ?
      '<button class="secondary" type="button" data-action="reopen">Вернуть на проверку</button>' : '') +
    (!record.submissionId && record.status === 'published' ?
      '<button class="secondary" type="button" data-action="hide">Скрыть карточку</button>' : '') +
    '</div><p class="detail-error" id="detail-error" role="status"></p></form>';
  const form = $('edit-form');
  form.onsubmit = event => { event.preventDefault(); mutate(record, 'publish', form, openedRevision); };
  form.onclick = event => {
    const action = event.target.dataset.action;
    if (action) mutate(record, action, form, openedRevision);
  };
  $('detail').querySelector('h2').focus({ preventScroll: true });
  if (matchMedia('(max-width: 700px)').matches) $('detail').scrollIntoView({ block: 'start' });
  render();
}

async function mutate(record, action, form, openedRevision) {
  const { contacts, ...entry } = Object.fromEntries(new FormData(form));
  for (const button of form.querySelectorAll('button')) button.disabled = true;
  const errorBox = $('detail-error');
  errorBox.textContent = '';
  try {
    await request({ action, id: record.id, submissionId: record.submissionId, revision: openedRevision, entry, contacts });
  } catch (error) {
    errorBox.textContent = error.message;
    for (const button of form.querySelectorAll('button')) button.disabled = false;
    return;
  }
  resetDetail();
  announce({ publish: 'Карточка опубликована.', hide: 'Карточка скрыта.',
    reject: 'Заявка отклонена.', reopen: 'Заявка возвращена на проверку.' }[action]);
  try {
    await load();
  } catch (error) {
    announce('Изменения сохранены. Список не обновился: ' + error.message, true);
  }
}

$('admin-search').oninput = render;
$('records').onclick = event => {
  const button = event.target.closest('[data-id]');
  if (button) openEditor(rows().find(record => record.id === button.dataset.id));
};
for (const button of document.querySelectorAll('[data-tab]')) {
  button.onclick = () => {
    tab = button.dataset.tab;
    $('admin-search').value = '';
    resetDetail();
    render();
  };
}
$('create').onclick = () => openEditor({ id: 'editor-' + crypto.randomUUID() });
$('refresh').onclick = async () => {
  try {
    await load();
    resetDetail();
    render();
    announce('Редакция обновлена.');
  } catch (error) {
    announce(error.message, true);
  }
};
$('more').onclick = async () => {
  $('more').disabled = true;
  try { await load(true); }
  catch (error) { announce(error.message, true); }
  finally { $('more').disabled = false; }
};
$('login').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await request({ action: 'login', password: new FormData(form).get('password') });
    form.reset();
    await load();
    announce('');
  } catch (error) {
    announce(error.message, true);
  } finally {
    button.disabled = false;
  }
};
$('logout').onclick = async () => {
  try {
    await request({ action: 'logout' });
    location.reload();
  } catch (error) {
    announce(error.message, true);
  }
};

(async () => {
  try {
    const response = await fetch('/startups.json');
    if (!response.ok) throw Error('Каталог недоступен.');
    baseline = await response.json();
    await load();
    announce('');
  } catch (error) {
    showLogin();
    announce(error.status === 401 ? '' : error.message, error.status !== 401);
  }
})();
