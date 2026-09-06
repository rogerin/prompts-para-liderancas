'use strict';
(() => {
  const C = window.WORKSHOP_CONTENT;
  const $ = (s, root=document) => root.querySelector(s);
  const esc = (x='') => String(x).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(20)), x=>x.toString(16).padStart(2,'0')).join('');
  const promptById = id => C.prompts.find(p=>p.id===id);
  const exerciseById = id => C.exercises.find(e=>e.id===id);
  const S = {index:0, backend:false, role:'guest', room:null, rooms:[], follow:true, source:null, poll:null, panel:'', activity:'', galleryScope:'gallery', galleryExercise:'', galleryItems:[], selected:new Set(), compare:false, libraryCategory:'', libraryQuery:'', promptId:'P01', busy:false, retention:7, timer:0};
  const panel = $('#panel');
  let galleryPending=false, galleryLoading=false, galleryRequest=0, galleryRevision=-1;
  let toastTimer;
  function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),7000); }
  function store(key,value) { try {sessionStorage.setItem(key,JSON.stringify(value));} catch { toast('Armazenamento local indisponível. Baixe o rascunho para não perdê-lo.');} }
  function read(key,fallback) {try {return JSON.parse(sessionStorage.getItem(key)) || fallback;} catch {return fallback;}}
  async function api(path,options={}) {
    const headers={'x-workshop':'1',...(options.headers||{})};
    if (typeof options.body==='object' && !(options.body instanceof File) && !(options.body instanceof Blob)) { headers['Content-Type']='application/json'; options.body=JSON.stringify(options.body); }
    const response=await fetch(path,{...options,headers,credentials:'same-origin',cache:'no-store'});
    let data; try {data=await response.json();} catch {data={detail:'Resposta inesperada do servidor.'};}
    if(!response.ok){ const error=new Error(typeof data.detail==='string'?data.detail:'Não foi possível concluir a operação.'); error.status=response.status; throw error; }
    return data;
  }
  function download(name,text,type='text/plain;charset=utf-8') {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  async function copy(text) {try {await navigator.clipboard.writeText(text);} catch {const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();if(!document.execCommand('copy')){t.remove();throw new Error('Não foi possível copiar. Selecione o texto manualmente.');}t.remove();}toast('Copiado. Cole na ferramenta de IA que você usa.');}
  function openPanel(kind,title,body) {S.panel=kind;$('#panel-title').textContent=title;$('#panel-body').innerHTML=body;panel.classList.toggle('compare-mode',kind==='gallery'&&S.compare);if(!panel.open)panel.showModal();$('#panel-body').scrollTop=0;}
  function closePanel() {panel.close();S.panel='';}
  panel.addEventListener('close',()=>{S.panel='';});
  function status(text,mode='') {$('#connection').textContent=text;$('#connection').className=mode;}
  function syncHeader() {
    $('#room-label').textContent=S.room?`${S.room.title} · ${S.room.registered} inscritos${S.room.closed?' · encerrada':''}`:'33 prompts · caso 100% fictício';
    const follow=$('#follow');follow.hidden=!(S.room&&S.role==='student');follow.textContent=S.follow?'Ao vivo · Pausar acompanhamento':'Exploração livre · Voltar ao vivo';
  }
  function qrCard() {
    if(S.room) return `<aside class="join-card"><span class="eyebrow">ACOMPANHE NO SEU DISPOSITIVO</span><h3>Entre na sala.</h3><div class="qr-frame"><img src="/api/rooms/${encodeURIComponent(S.room.code)}/qr.png" alt="QR code para entrar nesta sala" width="194" height="194"></div><div class="room-code">${esc(S.room.code)}</div><p>Escaneie a câmera do celular.<br>Sem instalar aplicativo.</p><button class="primary lime" data-action="copy-room">Copiar link de acesso ↗</button>${S.room.local_url?'<p class="local-warning">Endereço local. Configure PUBLIC_BASE_URL com o endereço acessível no celular antes da aula.</p>':''}</aside>`;
    return `<aside class="join-card"><span class="eyebrow">UMA EXPERIÊNCIA COMPARTILHADA</span><h3>Aprenda junto.<br>Compare na prática.</h3><div class="qr-frame"><div class="qr-empty"><span class="qr-symbol">▦</span><span>O QR code desta turma aparece ao criar uma sala.</span></div></div><button class="primary lime" data-action="room">${S.backend?'Criar ou entrar na sala':'Ver como ativar a sala'}</button><p>${S.backend?'Apresentador controla os slides.<br>Você constrói seu repertório.':'Prévia de estudo. Sincronização e envios precisam do servidor.'}</p></aside>`;
  }
  function render() {
    const slide=C.slides[S.index];
    const cards=slide.cards.map(c=>`<article class="info-card"><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p></article>`).join('');
    const promptBox=slide.prompts.length?`<section class="prompt-box" aria-label="Exemplos de prompts"><div class="box-heading"><span>REFERÊNCIAS PARA EXPLORAR</span><button class="text-button" data-action="library">Ver todos os 33 ↗</button></div><div class="prompt-choices">${slide.prompts.map(id=>{const p=promptById(id);return `<button class="prompt-choice" data-action="prompt" data-id="${id}"><span class="prompt-id">${id}</span><span>${esc(p.title)}</span></button>`;}).join('')}</div></section>`:'';
    const datasetLinks=slide.id==='caso'?'<div class="actions"><a class="primary" href="resources/dados/nucleo-casa-exercicios.xlsx" download>Baixar planilha de exercícios</a><button class="secondary" data-action="downloads">Ver todos os materiais</button></div>':'';
    const e=exerciseById(slide.exercise);
    const exercise=e?`<div class="exercise-callout"><div><b>Na prática · ${esc(e.title)}</b><p>${e.minutes} minutos · ${esc(e.deliverable)}</p></div><button class="primary" data-action="activity" data-id="${e.id}">Registrar minha tentativa ↗</button></div>`:'';
    let html;
    if(slide.kind==='welcome') html=`<section class="stage-slide" data-slide="${slide.id}"><div class="welcome-layout"><div><span class="hero-label">WORKSHOP · IA + DADOS + DECISÃO</span><h1><span class="hero-line">Do dado</span><span class="hero-line">à <span class="highlight">decisão.</span></span></h1><p class="lead">Prompts para Lideranças.<br>Contexto que orienta. Evidência que sustenta.<br>Decisões que devolvem tempo.</p><div class="hero-actions"><button class="primary" data-action="next">Começar a experiência →</button><button class="secondary" data-action="library">Explorar os prompts</button></div><span class="hero-meta">2H30 · 5 PERSPECTIVAS C-LEVEL · 7 EXERCÍCIOS</span></div>${qrCard()}</div><div class="card-grid welcome-cards">${cards}</div></section>`;
    else html=`<section class="stage-slide" data-slide="${slide.id}"><span class="eyebrow">${String(S.index+1).padStart(2,'0')} / ${esc(slide.chapter)} · KEYCORE ACADEMY</span><h2>${esc(slide.title)}</h2><p class="lead">${esc(slide.lead)}</p><div class="card-grid">${cards}</div>${datasetLinks}${promptBox}${exercise}${slide.kind==='compare'?'<div class="actions"><button class="primary" data-action="gallery">Abrir resultados autorizados ↗</button><button class="secondary" data-action="mine">Minhas tentativas</button></div>':''}${slide.kind==='downloads'||slide.kind==='closing'?'<div class="actions"><button class="primary" data-action="downloads">Baixar material de estudo ↗</button><button class="secondary" data-action="export-mine">Exportar minhas tentativas</button></div>':''}</section>`;
    $('#stage').innerHTML=html;$('#counter').textContent=`${String(S.index+1).padStart(2,'0')} / ${C.slides.length}`;$('#chapter').textContent=slide.chapter;
    $('#progress').style.width=`${(S.index+1)/C.slides.length*100}%`;
    $('[data-action=prev]').disabled=S.index===0;$('[data-action=next]', $('.slide-nav')).disabled=S.index===C.slides.length-1;
    syncHeader();
  }
  async function navigate(index,{remote=false}={}) {
    const next=Math.max(0,Math.min(C.slides.length-1,index));
    if(!remote&&S.room&&S.role==='presenter') {
      if(S.busy)return;S.busy=true;
      try {
        for(let attempt=0;attempt<2;attempt++) {
          try{S.room=await api(`/api/rooms/${S.room.code}`,{method:'PATCH',body:{slide:C.slides[next].id,version:S.room.version}});break;}
          catch(err){if(err.status!==409||attempt)throw err;S.room=await api(`/api/rooms/${S.room.code}`);}
        }
      }finally{S.busy=false;}
    } else if(!remote&&S.room&&S.role==='student'){S.follow=false;}
    S.index=next;render();window.scrollTo({top:0,behavior:'instant'});
  }
  function receiveState(room) {
    const prior=S.room;S.room=room;syncHeader();
    const remoteIndex=C.slides.findIndex(s=>s.id===room.slide);
    if(remoteIndex>=0&&(S.role==='presenter'||S.follow)&&S.index!==remoteIndex){S.index=remoteIndex;render();}
    else if(S.index===0&&prior?.code!==room.code)render();
    if(S.panel==='gallery'&&galleryRevision!==room.revision){galleryPending=true;refreshGalleryWhenReady();}
  }
  function galleryIsEditing() {
    return panel.contains(document.activeElement?.closest?.('form'))||Boolean($('.review-form[data-dirty="true"]'));
  }
  function refreshGalleryWhenReady() {
    if(S.panel!=='gallery'||!galleryPending||galleryLoading)return;
    if(galleryIsEditing()) {
      const notice=$('#gallery-update');
      if(notice){notice.hidden=false;notice.textContent='Novos resultados recebidos. Conclua e salve a revisão para atualizar a lista.';}
      return;
    }
    galleryLoading=true;
    loadGallery(S.galleryScope,{background:true}).catch(err=>toast(err.message)).finally(()=>{
      galleryLoading=false;
      if(galleryPending&&S.panel==='gallery')setTimeout(refreshGalleryWhenReady,1500);
    });
  }
  document.addEventListener('focusout',()=>setTimeout(refreshGalleryWhenReady,0));
  function connect() {
    S.source?.close();clearInterval(S.poll);S.poll=null;
    if(!S.room)return;
    status('Conectando à sala…');
    const roomCode=S.room.code;
    S.source=new EventSource(`/api/rooms/${roomCode}/events`);
    S.source.addEventListener('state',event=>{try{receiveState(JSON.parse(event.data));status('Conectado ao vivo','connected');clearInterval(S.poll);S.poll=null;}catch{toast('Atualização inválida. Recarregue a sala.');}});
    S.source.addEventListener('ended',()=>{S.source.close();clearInterval(S.poll);S.poll=null;status('Sala ou sessão indisponível','warning');toast('A sala foi excluída ou sua sessão expirou. Seus rascunhos permanecem nesta aba.');});
    S.source.onopen=()=>{status('Conectado ao vivo','connected');clearInterval(S.poll);S.poll=null;};
    S.source.onerror=()=>{
      status('Reconectando · conferência a cada 5s','warning');
      if(!S.poll)S.poll=setInterval(async()=>{try{receiveState(await api(`/api/rooms/${roomCode}`));}catch(err){if([401,403,404,409].includes(err.status)){clearInterval(S.poll);S.poll=null;S.source.close();status('Entre novamente na sala','warning');}}},5000);
    };
  }
  function useRoom(room) {S.room=room;store('kc-current-room',room.code);S.follow=true;S.index=Math.max(0,C.slides.findIndex(s=>s.id===room.slide));history.replaceState(null,'',`?sala=${encodeURIComponent(room.code)}`);render();connect();}
  async function refreshMe() {const me=await api('/api/me');S.role=me.role;S.rooms=me.rooms;S.retention=me.retention_days;return me;}
  async function roomPanel() {
    if(!S.backend) {openPanel('room','Da prévia para uma turma ao vivo',`<div class="notice warning">Este arquivo funciona como material de estudo. Não há servidor conectado, então não há sincronização entre dispositivos nem envio para a turma.</div><p>O projeto inclui o servidor, o banco de dados e o gerador de QR code. Para iniciar, execute na pasta do projeto:</p><pre class="code-box">python3 -m venv .venv\nsource .venv/bin/activate\npip install -r requirements.txt\npython scripts/start_local.py</pre><p class="muted">No Windows: <code>.venv\\Scripts\\activate</code>. Para usar no celular, configure o endereço acessível em <code>PUBLIC_BASE_URL</code>. A implantação e as permissões do GitHub não são feitas por esta prévia.</p>`);return;}
    await refreshMe();
    const studentForm=`<section class="panel-section"><h3>Sou participante</h3><form id="join-form"><div class="form-grid"><label>Código da sala<input name="code" value="${esc(S.room?.code||new URLSearchParams(location.search).get('sala')||'')}" required maxlength="10" autocomplete="off" pattern="[A-Za-z2-9]{10}"></label><label>Nome ou pseudônimo<input name="nickname" required minlength="2" maxlength="50" autocomplete="off" placeholder="Como o facilitador identifica você"></label></div><label>Cadeira ou grupo<select name="group"><option value="">Ainda não escolhi</option>${['CEO','CFO','COO','CMO','CHRO'].map(x=>`<option>${x}</option>`).join('')}</select></label><label class="checkbox-label"><input name="privacy_ack" type="checkbox" required><span>Entendi que o facilitador acessa meus envios para conduzir o workshop. A turma só verá tentativas autorizadas e aprovadas, com pseudônimo. Usarei somente dados fictícios. A sala tem retenção de ${S.retention} dias após sua criação.</span></label><button class="primary" type="submit">Entrar na sala →</button></form></section>`;
    const teacherForm=S.role==='presenter'?`<section class="panel-section"><h3>Criar nova turma</h3><form id="create-room"><label>Nome da turma<input name="title" required maxlength="80" value="Prompts para Lideranças · KeyCore"></label><button class="primary" type="submit">Criar sala e QR code</button></form></section>`:`<section class="panel-section"><h3>Sou facilitador</h3><p class="muted">Use a senha configurada no servidor. Ela nunca entra no link ou QR code da turma.</p><form id="login-form"><label>Senha do facilitador<input name="password" type="password" required autocomplete="current-password"></label><button class="secondary" type="submit">Acessar painel do facilitador</button></form></section>`;
    const current=S.room?`<div class="notice"><b>${esc(S.room.title)}</b><br>Código: ${esc(S.room.code)} · ${S.room.registered} inscritos · ${S.room.closed?'encerrada':'aberta'}<br><span class="muted">Expira em ${new Date(S.room.expires*1000).toLocaleString('pt-BR')}.</span><div class="actions"><button class="secondary" data-action="copy-room">Copiar link</button><button class="secondary" data-action="show-qr">Mostrar QR code</button>${S.role==='presenter'?`<button class="secondary" data-action="notes">Guia do facilitador</button><button class="secondary" data-action="review">Revisão privada</button><a class="secondary" href="/api/rooms/${S.room.code}/export" download>Exportar turma (privado)</a><button class="secondary" data-action="toggle-room">${S.room.closed?'Reabrir':'Encerrar'} sala</button><button class="secondary danger" data-action="delete-room">Excluir sala e dados</button>`:''}</div></div>`:'';
    openPanel('room','Sala do workshop',`${current}${S.rooms.length?`<section class="panel-section"><h3>Retomar uma sala</h3>${S.rooms.map(r=>`<div class="room-card"><div><b>${esc(r.title)}</b><small>${esc(r.code)} · ${r.registered} inscritos</small></div><button class="secondary" data-action="resume-room" data-id="${r.code}">Abrir sala</button></div>`).join('')}</section>`:''}${S.role==='presenter'?'':studentForm}${teacherForm}${S.role!=='guest'?'<button class="text-button" data-action="logout">Sair desta sessão</button>':''}`);
  }
  function library(id=S.promptId) {
    S.promptId=id||'P01';
    openPanel('library','Sua biblioteca de prompts',`<div class="toolbar"><label>Buscar por objetivo<input id="prompt-search" placeholder="Margem, conselho, fontes…" value="${esc(S.libraryQuery)}"></label><label>Categoria<select id="prompt-category"><option value="">Todas as categorias</option>${[...new Set(C.prompts.map(p=>p.category))].map(cat=>`<option${cat===S.libraryCategory?' selected':''}>${esc(cat)}</option>`).join('')}</select></label><button class="secondary" data-action="download-kit">Baixar 33 prompts</button></div><div class="library-layout"><div id="library-list" class="library-list" aria-label="Escolha um prompt"></div><article id="prompt-reader" class="prompt-reader"></article></div>`);
    updateLibraryList();showPrompt(S.promptId);
  }
  function updateLibraryList() {
    const q=S.libraryQuery.toLocaleLowerCase('pt-BR');
    const items=C.prompts.filter(p=>(!S.libraryCategory||p.category===S.libraryCategory)&&`${p.id} ${p.title} ${p.category} ${p.use}`.toLocaleLowerCase('pt-BR').includes(q));
    $('#library-list').innerHTML=items.length?items.map(p=>`<button class="library-item${p.id===S.promptId?' selected':''}" data-action="select-prompt" data-id="${p.id}"><small>${p.id} · ${esc(p.category)} · ${esc(p.level)}</small><b>${esc(p.title)}</b></button>`).join(''):'<div class="empty-state">Nenhum prompt encontrado.</div>';
  }
  function showPrompt(id) {
    const p=promptById(id);if(!p)return;S.promptId=id;updateLibraryList();
    $('#prompt-reader').innerHTML=`<span class="eyebrow">${p.id} / ${esc(p.category)}</span><h3>${esc(p.title)}</h3><p class="muted">${esc(p.use)}. Anexe: ${esc(p.files)}.</p><pre class="code-box" tabindex="0">${esc(p.text)}</pre><div class="actions"><button class="primary" data-action="copy-prompt" data-id="${id}">Copiar prompt</button><button class="secondary" data-action="download-prompt" data-id="${id}">Baixar .txt</button><button class="secondary" data-action="use-prompt" data-id="${id}">Usar em um exercício ↗</button></div><p class="muted">Substitua os campos entre colchetes. A plataforma não envia os textos a modelos de IA nem contrata créditos em seu nome.</p>`;
  }
  const draftKey = id=>`kc-draft:${S.room?.code||'estudo'}:${id}`;
  function draft(id){return read(draftKey(id),{client_id:uid(),prompt:'',result:'',model:'',settings:'',reflection:'',consent:false});}
  function captureDraft() {
    const f=$('#activity-form');if(!f)return null;const d={...draft(S.activity)};
    for(const name of ['prompt','result','model','settings','reflection'])d[name]=f.elements[name].value;
    d.consent=f.elements.consent.checked;store(draftKey(S.activity),d);return d;
  }
  function activity(id,startingPrompt) {
    const e=exerciseById(id);if(!e)return;S.activity=id;let d=draft(id);
    if(startingPrompt){d.prompt=startingPrompt;store(draftKey(id),d);}
    openPanel('activity',e.title,`<div class="notice"><b>${e.minutes} minutos · ${esc(e.deliverable)}</b><br>${esc(e.brief)}<br><span class="muted">${esc(e.tips)}</span></div>${!S.room||S.role!=='student'?'<div class="notice warning">Rascunho de estudo. Para enviar à turma, entre como participante em uma sala. Facilitador: use outro perfil de navegador para testar como aluno.</div>':''}<div id="activity-status" class="activity-status" role="status"></div><form id="activity-form"><div class="form-grid"><label>Modelo e versão informados<input name="model" value="${esc(d.model)}" maxlength="100" required placeholder="Ex.: ferramenta + nome exibido do modelo"></label><label>Configurações ou observações do teste<input name="settings" value="${esc(d.settings)}" maxlength="300" placeholder="Arquivos usados, modo de raciocínio etc."></label></div><div class="form-grid"><label>Prompt que você realmente usou<textarea class="large" name="prompt" minlength="15" maxlength="15000" required placeholder="Cole o prompt exatamente como foi enviado à IA">${esc(d.prompt)}</textarea></label><label>Resultado obtido<textarea class="large" name="result" maxlength="30000" placeholder="Cole a resposta, ou anexe o resultado abaixo">${esc(d.result)}</textarea></label></div><label>Anexos do resultado<input type="file" id="activity-files" name="files" accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg" multiple></label><p class="consent-note">Até 3 arquivos de 5 MiB cada. TXT, MD, CSV, JSON, PDF, PNG ou JPG. Imagens têm metadados removidos; PDFs não são verificados por antivírus. Não envie conteúdo pessoal ou confidencial.</p><label>O que funcionou, falhou ou você precisou corrigir?<textarea name="reflection" maxlength="4000" placeholder="Anote um cálculo conferido, uma lacuna ou uma melhoria">${esc(d.reflection)}</textarea></label><label class="checkbox-label"><input name="consent" type="checkbox"${d.consent?' checked':''}><span>Autorizo esta tentativa, incluindo texto, anexos e feedback, a ser mostrada à turma e no projetor após revisão do facilitador. Meu nome não será exibido na galeria. Posso revogar pela área Minhas tentativas. Isso não desfaz cópias que outras pessoas já tenham feito.</span></label><p class="consent-note">Sem marcar, seu envio continua privado para você e o facilitador. O rascunho salva apenas textos nesta aba, não arquivos ainda não enviados. Não é um backup permanente. Baixe-o antes de fechar o navegador.</p><div class="actions"><button class="primary" type="submit"${!S.room||S.role!=='student'?' disabled':''}>Enviar tentativa</button><button class="secondary" type="button" data-action="download-draft">Baixar meu rascunho</button><button class="secondary" type="button" data-action="mine">Minhas tentativas</button></div></form>`);
  }
  async function submitActivity(form) {
    if(!form.reportValidity())return;
    const d=captureDraft();const files=[...$('#activity-files').files];
    if(!d.result.trim()&&!files.length)throw new Error('Cole um resultado ou selecione um arquivo.');
    if(files.length>3||files.some(f=>f.size>5*1024*1024))throw new Error('Selecione até três arquivos de no máximo 5 MiB cada.');
    const button=$('button[type=submit]',form);button.disabled=true;button.textContent='Salvando…';
    try {
      const sub=await api(`/api/rooms/${S.room.code}/submissions`,{method:'POST',body:{...d,exercise:S.activity}});
      const failures=[];
      for(const file of files){try{await api(`/api/submissions/${sub.id}/attachments?filename=${encodeURIComponent(file.name)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});}catch(error){failures.push(`${file.name}: ${error.message}`);}}
      $('#activity-status').textContent=failures.length?`Texto salvo como tentativa ${sub.attempt}. Anexos não enviados: ${failures.join('; ')}. Reenvie somente os anexos em Minhas tentativas.`:`Tentativa ${sub.attempt} salva. ${d.consent?'Aguardando aprovação para aparecer na turma.':'Privada para você e o facilitador.'}`;
      d.client_id=uid();store(draftKey(S.activity),d);$('#activity-files').value='';button.textContent='Enviar nova tentativa';
      toast(failures.length?'Tentativa salva com falha em anexo. Veja a mensagem do formulário.':'Tentativa salva. O compartilhamento nunca é automático.');
    } catch(error){button.textContent='Tentar enviar novamente';throw error;} finally{button.disabled=false;}
  }
  function submissionCard(s) {
    const isMine=S.galleryScope==='mine', review=S.galleryScope==='review';
    return `<article class="submission-card" data-submission="${s.id}"><div class="submission-meta">${esc(s.alias)}${review?` · ${esc(s.nickname)}`:''} · ${esc(s.group||'Sem grupo')}<br>${esc(exerciseById(s.exercise)?.title||s.exercise)} · tentativa ${s.attempt}</div><h3>${esc(s.model)}</h3><div class="submission-meta">${new Date(s.created*1000).toLocaleString('pt-BR')} · ${esc(s.dataset_version)}<br>${esc(s.settings||'Configurações não informadas')}</div><div class="actions"><span class="badge${s.published?' approved':''}">${s.published?'Compartilhado':s.consent?'Autorizado, não publicado':'Privado'}</span>${s.scores?`<span class="badge">${Object.values(s.scores).reduce((a,b)=>a+b,0)} / 20</span>`:''}</div><label class="checkbox-label"><input type="checkbox" data-select="${s.id}"${S.selected.has(s.id)?' checked':''}><span>Selecionar para comparar</span></label><details${S.compare?' open':''}><summary>Prompt utilizado</summary><div class="submission-text">${esc(s.prompt)}</div></details><details open><summary>Resultado obtido</summary><div class="submission-text">${esc(s.result||'Resultado em anexo.')}</div></details>${s.reflection?`<details${S.compare?' open':''}><summary>Reflexão do participante</summary><div class="submission-text">${esc(s.reflection)}</div></details>`:''}${s.attachments.map(f=>`<a class="attachment" href="/api/files/${f.id}" download>↓ ${esc(f.filename)} (${(f.size/1024).toFixed(1)} KiB)</a>`).join('')}${s.attachments.length?'<p class="consent-note">Arquivos enviados por participantes. Baixe apenas quando confiar na origem; PDFs podem conter conteúdo ativo.</p>':''}${s.scores?`<details><summary>Rubrica e feedback</summary><div class="submission-text">${C.rubric.map(r=>`${esc(r.name)}: ${s.scores[r.id]} / 4`).join('<br>')}<br><br>${esc(s.feedback||'Sem comentário.')}</div></details>`:''}${isMine?`<div class="actions"><button class="secondary" data-action="toggle-consent" data-id="${s.id}">${s.consent?'Revogar autorização':'Autorizar compartilhamento'}</button><button class="secondary danger" data-action="delete-submission" data-id="${s.id}">Excluir</button></div><label>Anexar outro resultado<input type="file" data-attach="${s.id}" accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg"></label>`:''}${review?`<form class="review-form" data-id="${s.id}"><div class="score-grid">${C.rubric.map(r=>`<label>${esc(r.name)}<input name="${r.id}" type="number" min="0" max="4" value="${s.scores?.[r.id]??''}" aria-label="Nota de ${esc(r.name)}"></label>`).join('')}</div><label>Feedback verificável<textarea name="feedback" maxlength="3000">${esc(s.feedback||'')}</textarea></label><label class="checkbox-label"><input name="published" type="checkbox"${s.published?' checked':''}${!s.consent?' disabled':''}><span>Exibir na turma ${!s.consent?'(autor não autorizou)':''}</span></label><button class="primary small" type="submit">Salvar revisão</button></form>`:''}</article>`;
  }
  async function loadGallery(scope=S.galleryScope,{background=false}={}) {
    if(!S.room){await roomPanel();return;}
    S.galleryScope=scope;
    const request=++galleryRequest,roomCode=S.room.code,revision=S.room.revision,exercise=S.galleryExercise;
    const [result,counts]=await Promise.all([
      api(`/api/rooms/${roomCode}/submissions?scope=${scope}${exercise?`&exercise=${encodeURIComponent(exercise)}`:''}`),
      S.role==='presenter'&&scope==='gallery'?api(`/api/rooms/${roomCode}/submission-summary`):Promise.resolve(null)
    ]);
    if(request!==galleryRequest||S.room?.code!==roomCode||S.galleryScope!==scope||S.galleryExercise!==exercise)return;
    if(background&&(S.panel!=='gallery'||galleryIsEditing()))return;
    galleryRevision=revision;galleryPending=S.room.revision!==revision;
    S.galleryItems=result;
    const scrollTop=$('#panel-body').scrollTop;
    if(S.compare) {const ids=new Set(result.map(s=>s.id));S.selected=new Set([...S.selected].filter(id=>ids.has(id)));}
    const shown=S.compare?result.filter(s=>S.selected.has(s.id)):result;
    const pendingNotice=counts?`<div class="notice"><b>${counts.pending_review} ${counts.pending_review===1?'envio aguarda':'envios aguardam'} sua revisão.</b> Total da sala: ${counts.total} · Compartilhados: ${counts.published} · Sem autorização: ${counts.without_consent}.<br>Os envios autorizados aparecem aqui depois que você marca “Exibir na turma” e salva em <button class="text-button" data-action="review">Revisão privada</button>.</div>`:'';
    openPanel('gallery',scope==='review'?'Revisão privada do facilitador':scope==='mine'?'Minhas tentativas':'Resultados para aprender em conjunto',`${scope==='review'?'<div class="notice warning"><b>Não projete esta tela.</b> Aqui aparecem envios privados e nomes informados ao facilitador. Use a Galeria da turma no telão. Aprovar exige autorização do autor.</div>':'<div class="notice">Compare até três tentativas. Considere contexto, evidência, verificabilidade, limites e ação. Não há ranking automático nem avaliação por IA.</div>'}${pendingNotice}<div id="gallery-update" class="notice" role="status" hidden></div><div class="toolbar"><label>Atividade<select id="gallery-exercise"><option value="">Todas as atividades</option>${C.exercises.map(e=>`<option value="${e.id}"${S.galleryExercise===e.id?' selected':''}>${esc(e.title)}</option>`).join('')}</select></label><button class="secondary" data-action="gallery">Galeria da turma</button>${S.role==='student'?'<button class="secondary" data-action="mine">Minhas tentativas</button>':''}${S.role==='presenter'?'<button class="secondary" data-action="review">Revisão privada</button>':''}<button class="primary" data-action="compare-selected">${S.compare?'Sair da comparação':`Comparar selecionados (${S.selected.size})`}</button><button class="secondary" data-action="refresh-gallery">Atualizar</button></div><div class="gallery-grid">${shown.length?shown.map(submissionCard).join(''):`<div class="empty-state">${scope==='review'?'Nenhum envio recebido neste recorte. Confira a atividade selecionada.':scope==='mine'?'Você ainda não enviou uma tentativa neste recorte.':'Nenhum resultado compartilhado neste recorte. São necessárias a autorização do participante e a aprovação do facilitador.'}</div>`}</div>${scope==='mine'?'<div class="actions"><button class="secondary" data-action="export-mine">Exportar meus textos e feedback</button></div>':''}`);
    if(background)$('#panel-body').scrollTop=scrollTop;
  }
  function studyKit() {return `# Prompts para Lideranças | KeyCore Academy\n\n33 prompts completos. Caso fictício NC-2026.1. Nenhum modelo é executado nesta plataforma.\n\n`+C.prompts.map(p=>`## ${p.id} | ${p.category} | ${p.title}\n\nQuando usar: ${p.use}.\n\n${p.text}\n\n`).join('');}
  function downloads() {
    openPanel('downloads','Material para continuar aprendendo',`<div class="notice">Conteúdo didático público, sem respostas da turma. Os anexos e envios de participantes não entram neste kit.</div><div class="download-grid"><button class="download-tile" data-action="download-kit"><small>MARKDOWN · EDITÁVEL</small><b>33 prompts completos</b><span>Referência para copiar e adaptar.</span></button><button class="download-tile" data-action="download-json"><small>JSON · ESTRUTURADO</small><b>Biblioteca de prompts</b><span>Importe em suas próprias ferramentas.</span></button><a class="download-tile" href="resources/dados/nucleo-casa-exercicios.xlsx" download><small>EXCEL · NC-2026.1</small><b>Planilha de exercícios</b><span>12 abas, 504 registros de origem e 19 exercícios.</span></a><a class="download-tile" href="resources/kit-estudo-completo.zip" download><small>ZIP · MATERIAL COMPLETO</small><b>Base + guias + prompts</b><span>Planilha Excel, CSVs, dicionário, canvas e rubrica.</span></a><a class="download-tile" href="resources/dados/nucleo-casa-mensal.csv" download><small>CSV · NC-2026.1</small><b>Dados de vendas</b><span>432 registros inteiramente fictícios.</span></a><a class="download-tile" href="resources/dados/LEIA-ME.md" download><small>MARKDOWN · DICIONÁRIO</small><b>Fontes e fórmulas</b><span>O que pode e não pode ser calculado.</span></a><button class="download-tile" data-action="export-mine"><small>PESSOAL · SOMENTE SEUS ENVIOS</small><b>Meu percurso</b><span>Prompts, resultados, reflexões e feedback.</span></button></div><p class="muted">Os arquivos do kit são públicos e inteiramente fictícios. Na prévia isolada, os materiais estão incorporados para download, sem precisar de servidor.</p>`);
  }
  async function exportMine() {
    if(!S.room||S.role!=='student')throw new Error('Entre como participante para exportar seus envios. Rascunhos podem ser baixados dentro do exercício.');
    const submissions=await api(`/api/rooms/${S.room.code}/submissions?scope=mine`);
    if(!submissions.length)throw new Error('Você ainda não enviou tentativas nesta sala.');
    const text=`# Meu percurso | ${S.room.title}\n\nExportado em ${new Date().toLocaleString('pt-BR')}. Caso fictício ${C.datasetVersion}.\n\n`+submissions.map(s=>`## ${exerciseById(s.exercise).title} | Tentativa ${s.attempt}\n\nModelo: ${s.model}\nConfigurações: ${s.settings||'Não informadas'}\n\n### Prompt\n${s.prompt}\n\n### Resultado\n${s.result}\n\n### Reflexão\n${s.reflection}\n\n### Feedback\n${s.feedback||'Não informado'}\n${s.scores?C.rubric.map(r=>`${r.name}: ${s.scores[r.id]}/4`).join('\n'):''}\n\nAnexos (baixe separadamente antes da expiração da sala): ${s.attachments.map(f=>f.filename).join(', ')||'Nenhum'}.\n\n`).join('');
    download(`meu-percurso-${S.room.code}.md`,text);toast('Seus textos foram exportados. Baixe anexos separadamente em Minhas tentativas.');
  }
  function map() {openPanel('map','Roteiro da experiência',`<div class="inline-stats">${C.agenda.map(a=>`<span><b>${a.minutes} min</b> · ${esc(a.title)}</span>`).join('')}</div><div class="map-list">${C.slides.map((s,i)=>`<button class="map-button${i===S.index?' active':''}" data-action="goto" data-index="${i}"><small>${String(i+1).padStart(2,'0')}</small><span>${esc(s.title)}</span></button>`).join('')}</div>`);}
  function notes() {
    if(S.role!=='presenter')throw new Error('Área de facilitação.');
    const s=C.slides[S.index];
    openPanel('notes','Guia do facilitador',`<div class="notice warning">Use em uma tela privada. A turma acompanha os slides, não este painel.</div><span class="eyebrow">SLIDE ${S.index+1} / ${esc(s.chapter)}</span><h3>${esc(s.title)}</h3><div class="notes">${esc(s.notes)}</div><h3>Ritmo sugerido · 150 minutos</h3>${C.agenda.map(a=>`<p class="muted"><b>${a.minutes} min</b> · ${esc(a.title)}</p>`).join('')}<h3>Âncoras de avaliação</h3>${Object.entries(C.rubricAnchors).map(([k,v])=>`<p class="muted"><b>${k}</b> · ${esc(v)}</p>`).join('')}`);
  }
  document.addEventListener('click', event=>{
    const anchor=event.target.closest('a[download]');
    const path=anchor?.getAttribute('href');
    const asset=window.WORKSHOP_OFFLINE_ASSETS?.[path];
    if(asset){event.preventDefault();const link=document.createElement('a');link.href=asset;link.download=path.split('/').pop();link.click();}
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    event.preventDefault();const action=button.dataset.action, id=button.dataset.id;
    try {
      switch(action){
        case 'close':closePanel();break;
        case 'next':await navigate(S.index+1);break;
        case 'prev':await navigate(S.index-1);break;
        case 'goto':closePanel();await navigate(Number(button.dataset.index));break;
        case 'map':map();break;
        case 'room':await roomPanel();break;
        case 'copy-room':await copy(S.room.join_url);break;
        case 'show-qr':closePanel();await navigate(0);break;
        case 'resume-room':useRoom(await api(`/api/rooms/${id}`));closePanel();break;
        case 'library':library();break;
        case 'prompt':S.libraryQuery='';S.libraryCategory='';library(id);break;
        case 'select-prompt':showPrompt(id);break;
        case 'copy-prompt':await copy(promptById(id).text);break;
        case 'download-prompt':download(`${id}-${promptById(id).category}.txt`,promptById(id).text);break;
        case 'download-kit':download('keycore-33-prompts.md',studyKit());break;
        case 'download-json':download('keycore-prompts.json',JSON.stringify(C.prompts,null,2),'application/json');break;
        case 'downloads':downloads();break;
        case 'use-prompt':{
          const p=promptById(id), lookup={'Fundamentos':'revisao','Auditoria':'auditoria','RAG':'auditoria','Dashboard':'dashboard','Conselho':'conselho','Validação':'revisao'};
          activity(C.slides[S.index].exercise||lookup[p.category]||'cadeira',p.text);break;
        }
        case 'activity':activity(id);break;
        case 'download-draft':{const d=captureDraft();download(`rascunho-${S.activity}.md`,`# ${exerciseById(S.activity).title}\n\nModelo: ${d.model}\nConfigurações: ${d.settings}\n\n## Prompt\n${d.prompt}\n\n## Resultado\n${d.result}\n\n## Reflexão\n${d.reflection}\n`);break;}
        case 'gallery':S.galleryScope='gallery';S.compare=false;S.selected.clear();await loadGallery();break;
        case 'mine':captureDraft();S.galleryScope='mine';S.compare=false;S.selected.clear();await loadGallery();break;
        case 'review':S.galleryScope='review';S.compare=false;S.selected.clear();await loadGallery();break;
        case 'refresh-gallery':await loadGallery();break;
        case 'compare-selected':if(!S.compare&&S.selected.size<2)throw new Error('Selecione duas ou três tentativas para comparar.');S.compare=!S.compare;await loadGallery();break;
        case 'toggle-consent':{const s=S.galleryItems.find(x=>x.id===id);if(!s.consent&&!confirm('Autorizar texto, anexos e feedback desta tentativa para a turma após aprovação do facilitador?'))return;await api(`/api/submissions/${id}/consent`,{method:'PATCH',body:{consent:!s.consent}});await loadGallery();break;}
        case 'delete-submission':if(confirm('Excluir esta tentativa e seus anexos? Esta ação não pode ser desfeita.')){await api(`/api/submissions/${id}`,{method:'DELETE'});S.selected.delete(id);await loadGallery();}break;
        case 'export-mine':await exportMine();break;
        case 'notes':notes();break;
        case 'follow':S.follow=!S.follow;if(S.follow){S.room=await api(`/api/rooms/${S.room.code}`);receiveState(S.room);}syncHeader();break;
        case 'toggle-room':S.room=await api(`/api/rooms/${S.room.code}`,{method:'PATCH',body:{closed:!S.room.closed,version:S.room.version}});syncHeader();await roomPanel();break;
        case 'delete-room':if(confirm('Excluir definitivamente esta sala, todas as tentativas e todos os anexos? Exporte antes os registros necessários.')){await api(`/api/rooms/${S.room.code}`,{method:'DELETE'});S.source?.close();clearInterval(S.poll);S.room=null;S.index=0;history.replaceState(null,'',location.pathname);status('Modo de estudo');render();await roomPanel();}break;
        case 'logout':await api('/api/logout',{method:'POST'});S.source?.close();clearInterval(S.poll);S.room=null;S.role='guest';S.index=0;status('Modo de estudo');render();closePanel();break;
        case 'fullscreen':if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();break;
      }
    } catch(error){toast(error.message);}
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='prompt-search'){S.libraryQuery=event.target.value;updateLibraryList();}
    if(event.target.closest('#activity-form'))captureDraft();
    const review=event.target.closest('.review-form');if(review)review.dataset.dirty='true';
  });
  document.addEventListener('change',async event=>{
    const review=event.target.closest('.review-form');if(review)review.dataset.dirty='true';
    try{
      if(event.target.id==='prompt-category'){S.libraryCategory=event.target.value;updateLibraryList();}
      if(event.target.id==='gallery-exercise'){S.galleryExercise=event.target.value;S.compare=false;S.selected.clear();await loadGallery();}
      if(event.target.dataset.select){const id=event.target.dataset.select;if(event.target.checked){if(S.selected.size>=3){event.target.checked=false;throw new Error('Compare no máximo três tentativas por vez.');}S.selected.add(id);}else S.selected.delete(id);const b=$('[data-action=compare-selected]');if(b&&!S.compare)b.textContent=`Comparar selecionados (${S.selected.size})`;}
      if(event.target.dataset.attach){const file=event.target.files[0];if(file){await api(`/api/submissions/${event.target.dataset.attach}/attachments?filename=${encodeURIComponent(file.name)}`,{method:'POST',body:file,headers:{'Content-Type':'application/octet-stream'}});toast('Anexo salvo. Esta tentativa voltou para revisão.');await loadGallery();}}
    }catch(error){toast(error.message);}
  });
  document.addEventListener('submit',async event=>{
    const f=event.target;event.preventDefault();
    try{
      if(f.id==='login-form'){await api('/api/login',{method:'POST',body:{password:f.elements.password.value}});await roomPanel();}
      else if(f.id==='create-room'){const room=await api('/api/rooms',{method:'POST',body:{title:f.elements.title.value}});useRoom(room);closePanel();toast('Sala criada. Mostre o QR code e confirme o endereço no celular.');}
      else if(f.id==='join-form'){const code=f.elements.code.value.trim().toUpperCase();const result=await api(`/api/rooms/${code}/join`,{method:'POST',body:{nickname:f.elements.nickname.value,group:f.elements.group.value,privacy_ack:f.elements.privacy_ack.checked}});S.role=result.role;useRoom(result.room);closePanel();toast('Você está acompanhando o apresentador. Seus rascunhos não mudam quando o slide muda.');}
      else if(f.id==='activity-form'){await submitActivity(f);}
      else if(f.classList.contains('review-form')){
        const scores={};const values=C.rubric.map(r=>f.elements[r.id].value);
        if(values.some(v=>v!=='')){if(values.some(v=>v===''))throw new Error('Preencha as cinco notas ou deixe todas vazias.');C.rubric.forEach(r=>scores[r.id]=Number(f.elements[r.id].value));}
        await api(`/api/submissions/${f.dataset.id}/review`,{method:'PATCH',body:{published:f.elements.published.checked,scores:Object.keys(scores).length?scores:null,feedback:f.elements.feedback.value}});toast('Revisão salva.');await loadGallery();
      }
    }catch(error){toast(error.message);}
  });
  document.addEventListener('keydown',event=>{
    if(panel.open||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
    if(['ArrowRight','ArrowLeft',' '].includes(event.key)){event.preventDefault();navigate(S.index+(event.key==='ArrowLeft'?-1:1)).catch(error=>toast(error.message));}
    if(event.key.toLowerCase()==='f')$('[data-action=fullscreen]').click();
  });
  window.addEventListener('online',()=>{if(S.room)connect();});
  window.addEventListener('offline',()=>{status('Sem conexão · rascunho nesta aba','warning');});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.room)api(`/api/rooms/${S.room.code}`).then(receiveState).catch(()=>{});});
  async function init(){
    const logo=$('#brand-logo');const showLogo=()=>{logo.hidden=false;$('#brand-fallback').hidden=true;};logo.addEventListener('load',showLogo);logo.addEventListener('error',()=>{logo.hidden=true;});if(logo.complete&&logo.naturalWidth)showLogo();
    render();
    if(location.protocol==='file:'||window.WORKSHOP_STANDALONE){status('Prévia local · modo de estudo');return;}
    try{await api('/api/health');S.backend=true;await refreshMe();status('Servidor disponível · escolha uma sala');
      const code=new URLSearchParams(location.search).get('sala')||read('kc-current-room','');
      const room=S.rooms.find(r=>r.code===code);if(room)useRoom(room);else if(code||new URLSearchParams(location.search).has('facilitador'))await roomPanel();render();
    }catch{status('Prévia estática · sem sincronização');render();}
  }
  init();
})();
