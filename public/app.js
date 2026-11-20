const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let projects = [];
const locations = {'Астана':[389,137.3],'Алматы':[465.5,303],'Рудный':[272.7,98.6]};
const unknown = 'Город не указан';
const dialog = $('dialog');
const logo = p => p.logo ? '<img class="logo" loading="lazy" src="/'+esc(p.logo)+'" alt="Логотип '+esc(p.name)+'">' : '<span class="logo">'+esc(p.name.slice(0,2))+'</span>';
function openPanel(html) {
  $('content').innerHTML = html;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
dialog.querySelector('.close').onclick = () => dialog.close();
dialog.addEventListener('click', e => { if(e.target === dialog && !e.target.matches(':hover')) dialog.close(); });
function profile(p) {
  const fields = [[p.role,p.team],['Целевая аудитория',p.audience],['Стадия / статус',p.stage],['Связь с Казахстаном',p.geo],['Проверено',p.checked.split('-').reverse().join('.')]];
  openPanel(logo(p)+'<h2 id="title">'+esc(p.name)+'</h2><p>'+esc(p.description)+'</p><span class="tag">'+esc(p.sector)+'</span><dl>'+
    fields.map(([key,value])=>'<dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd>').join('')+'</dl><strong>Ссылки и источники</strong><div>'+
    Object.entries(p.links).map(([label,url])=>'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(label)+' ↗</a>').join('')+'</div>');
}
function render() {
  const terms = $('query').value.trim().toLocaleLowerCase('ru').split(/\s+/);
  const list = projects.filter(p => {
    const text = [p.name,p.team,p.description,p.audience,p.sector,p.city,p.stage].join(' ').toLocaleLowerCase('ru');
    return terms.every(t=>text.includes(t)) && (!$('sector').value || $('sector').value===p.sector) && (!$('city').value || $('city').value===(p.city || unknown));
  });
  $('cards').innerHTML = list.map(p=>'<button class="card" data-id="'+esc(p.id)+'"><span class="cardtop">'+logo(p)+'<span class="tag">'+esc(p.sector)+'</span></span><h3>'+esc(p.name)+'</h3><p>'+esc(p.description)+'</p><span class="cardfoot"><span>'+esc(p.city || 'nFactorial · Казахстан')+'</span><span class="arrow" aria-hidden="true">↗</span></span></button>').join('') || '<p class="empty">Совпадений нет. Попробуйте другое название или сбросьте фильтры.</p>';
  $('count').textContent = 'Показано проектов: '+list.length+' из '+projects.length;
  $('reset').hidden = !($('query').value || $('sector').value || $('city').value);
}
function clearFilters() { for (const key of ['query','sector','city']) $(key).value=''; render(); }
$('reset').onclick = clearFilters;
$('cards').onclick = e => { const card=e.target.closest('[data-id]'); if(card) profile(projects.find(p=>p.id===card.dataset.id)); };
for (const key of ['query','sector','city']) $(key).addEventListener('input',render);
$('about').onclick=()=>openPanel('<div class="eyebrow">DALA ATLAS</div><h2 id="title">Об атласе</h2><p>Каталог объединяет компании с командой или корнями в Казахстане и ИИ-проекты казахстанского инкубатора nFactorial. Участие в программе указано в карточке проекта.</p><p>Город обозначает подтверждённую связь с командой, автором или программой. В карточке указано основание. Проекты без подтверждённого города доступны через фильтр.</p><p>Сведения о продукте и команде сверяются с первоисточниками. Заявки проходят редакторскую проверку.</p><small>Границы карты: Natural Earth, 1:50m.</small>');
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
  const res=await fetch('/startups.json'); if(!res.ok) throw Error(); projects=await res.json();
  for(const key of ['sector','city']) for(const v of [...new Set(projects.map(p=>p[key] || unknown))].sort((a,b)=>a.localeCompare(b,'ru'))) $(key).add(new Option(v,v));
  for(const [city,[x,y]] of Object.entries(locations)) {
    if(!projects.some(p=>p.city===city)) continue;
    const b=document.createElement('button');b.className='pin';b.style.left=x/650*100+'%';b.style.top=y/380*100+'%';
    b.innerHTML='<i></i><b>'+city+'</b>';b.ariaLabel='Показать проекты: '+city;
    b.onclick=()=>{clearFilters();$('city').value=city;render();$('catalog').scrollIntoView();};$('pins').append(b);
  }
  $('total').textContent=projects.length;render();
}
init().catch(()=>{$('count').textContent='Не удалось загрузить каталог. Обновите страницу.';});
