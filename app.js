import { createAssessmentModel } from './assessment-model.js';

const STORAGE = 'mcs-wash-assessment-v3';
const LEGACY_STORAGE = 'mcs-wash-assessment-v2.3';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let saved = {}, storageOK = true;
try {
  const parsed = JSON.parse(localStorage.getItem(STORAGE) || localStorage.getItem(LEGACY_STORAGE) || '{}');
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  for (const key of ['answers', 'comments', 'unknown']) {
    if (!saved[key] || typeof saved[key] !== 'object' || Array.isArray(saved[key])) saved[key] = {};
  }
  // Site/contact and operating model are the only mandatory questions.
  delete saved.unknown.G02; delete saved.unknown.O01;
} catch { storageOK = false; }
const m = createAssessmentModel(saved);
let step = Number.isInteger(saved.step) ? Math.max(0, Math.min(m.reviewStep, saved.step)) : 0;
let submitted = saved.schemaVersion === '3.1' ? saved.submitted || null : null, sending = false, submissionError = '', showErrors = false;
let submissionId = saved.schemaVersion === '3.1' ? saved.submissionId || '' : '', toastTimer;
const isLocal = () => location.protocol === 'file:' || ['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname);
const sectionNames = ['Site details', 'Cleaning operation', 'Resources & costs', 'Demand & priorities', 'Review & submit'];
const sectionDescriptions = ['Contact & location', 'Volumes, containers & setup', 'Staffing, utilities & handling', 'Capacity & additional options', 'Check answers & send'];
const imageInfo = {
  ground: ['assets/floored-containers.jpg', 'On the ground / floored', 'Containers are lifted into and out of the wash position.'],
  chassis: ['assets/chassi-containers.jpg', 'On chassis / trailer', 'Containers remain on a chassis during washing.'],
  regular: ['assets/normal-contamination.PNG', 'Regular contamination', 'Normal dirt, staining or light cargo residue.'],
  heavy: ['assets/heavy-contamination.PNG', 'Heavy contamination', 'Substantial or persistent residues that need extra cleaning or preparation.']
};

function persist() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify({...m.state, step, submitted, submissionId}));
    storageOK = true;
  } catch { storageOK = false; }
  for (const status of document.querySelectorAll('[data-storage]')) status.textContent = storageOK ? 'Draft saved on this device' : 'Draft not saved — download a copy';
}
function changed() { submitted = null; submissionId = ''; submissionError = ''; persist(); }
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}
function unit(f) { return f.unit?.startsWith('per ') ? `${m.currency()} / ${f.unit.slice(4)}` : f.unit || ''; }
function fieldErrors(id, key) { return showErrors ? m.errors().filter(e => e.id === id && e.key === key) : []; }
function input(q, f) {
  const value = m.v(q.id, f.key), uid = `${q.id}-${f.key}`;
  const disabled = m.state.unknown[q.id] ? 'disabled' : '';
  const attr = `data-q="${q.id}" data-key="${f.key}"`;
  const errors = fieldErrors(q.id, f.key);
  const described = [f.hint ? `${uid}-hint` : '', errors.length ? `${uid}-error` : ''].filter(Boolean).join(' ');
  const aria = `${described ? `aria-describedby="${described}"` : ''} ${errors.length ? 'aria-invalid="true"' : ''}`;
  let control;
  if (['radio','multi'].includes(f.type)) {
    const selected = Array.isArray(value) ? value : [];
    const photos = q.kind === 'position' && f.key === 'position';
    control = `<fieldset class="options" ${aria}><legend>${esc(f.label)}${q.id==='O01' ? ' <span class="required">*</span>' : ''}</legend><div class="choicegrid ${photos?'photo-choices':''}">${f.options.map(([key,label]) => `<label class="choice ${photos&&imageInfo[key]?'photo-choice':''} ${photos&&key==='other'?'wide':''}">${photos&&imageInfo[key]?`<img src="${imageInfo[key][0]}" alt="${esc(imageInfo[key][1])}" loading="lazy">`:''}<span class="choice-body"><input id="${uid}-${key}" ${attr} type="${f.type==='multi'?'checkbox':'radio'}" name="${uid}" value="${key}" ${f.type==='multi'?(selected.includes(key)?'checked':''):(value===key?'checked':'')} ${disabled}><span><strong>${esc(label)}</strong>${photos&&imageInfo[key]?`<small>${esc(imageInfo[key][2])}</small>`:''}</span></span></label>`).join('')}</div></fieldset>`;
  } else {
    if (f.type === 'textarea') control = `<textarea id="${uid}" ${attr} ${aria} maxlength="5000" placeholder="${esc(f.placeholder || 'Enter details…')}" ${disabled}>${esc(value)}</textarea>`;
    else if (f.type === 'select') control = `<select id="${uid}" ${attr} ${aria} ${f.required?'required':''} ${disabled}><option value="">Select currency</option>${f.options.map(o=>`<option ${value===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
    else control = `<div class="input-wrap ${f.unit?'has-unit':''}"><input id="${uid}" type="${f.type}" ${attr} ${aria} value="${esc(value)}" ${f.required?'required':''} ${f.autocomplete?`autocomplete="${f.autocomplete}"`:''} ${f.type==='number'?`min="${f.min??0}" ${f.max!==undefined?`max="${f.max}"`:''} step="any" inputmode="decimal"`:'maxlength="250"'} placeholder="${f.type==='number'?'—':esc(({company:'Company name',site:'Terminal or depot name',city:'City',country:'Country',contact:'Full name',email:'you@company.com',other_currency:'e.g. AED'})[f.key]||'Your answer')}" ${disabled}>${f.unit?`<span class="unit">${esc(unit(f))}</span>`:''}</div>`;
    control = `<label for="${uid}">${esc(f.label)}${f.required?' <span class="required">*</span>':''}</label>${control}`;
  }
  return `<div class="field ${['textarea','radio','multi'].includes(f.type)?'wide':''}">${control}${f.hint?`<p class="field-hint" id="${uid}-hint">${esc(f.hint)}</p>`:''}${errors.length?`<p class="field-error" id="${uid}-error">${esc(errors[0].message)}</p>`:''}</div>`;
}
function shiftHtml() {
  return `<div class="shifts">${m.rows().map((r,i)=>`<div class="shift-block"><div class="shift-heading"><strong>Shift ${String(i+1).padStart(2,'0')}</strong>${m.rows().length>1?`<button type="button" class="text-btn" data-action="remove-shift" data-index="${i}" ${m.state.unknown.L01?'disabled':''}>Remove shift ${i+1} ×</button>`:''}</div><div class="fieldgrid"><div class="field wide"><label for="shift-${i}-period">Shift timing</label><select id="shift-${i}-period" data-shift="${i}" data-skey="period" ${m.state.unknown.L01?'disabled':''}><option value="">Select timing</option>${m.shiftPeriods.map(([key,label])=>`<option value="${key}" ${r.period===key?'selected':''}>${label}</option>`).join('')}</select></div>${m.shiftFields().map(([key,label,u])=>`<div class="field"><label for="shift-${i}-${key}">${esc(label)}</label><div class="input-wrap has-unit"><input id="shift-${i}-${key}" type="number" min="${key==='hours'?'0.01':'0'}" ${key==='hours'?'max="24"':key==='allocation'?'max="100"':''} step="any" inputmode="decimal" data-shift="${i}" data-skey="${key}" value="${esc(r[key]??'')}" placeholder="—" ${m.state.unknown.L01?'disabled':''}><span class="unit">${esc(u)}</span></div></div>`).join('')}</div></div>`).join('')}<button type="button" class="btn compact" data-action="add-shift" ${m.rows().length>=6||m.state.unknown.L01?'disabled':''}>+ Add another shift</button></div>`;
}
function illustrations(q) {
  if (q.kind !== 'severity') return '';
  return `<div class="severity">${['regular','heavy'].map(key=>`<figure class="severity-card"><button type="button" class="photo-button ${key}" data-photo="${key}" aria-label="Enlarge ${imageInfo[key][1].toLowerCase()} photo"><img src="${imageInfo[key][0]}" alt="${esc(imageInfo[key][2])}" loading="lazy"><span>View photo ↗</span></button><figcaption><strong>${imageInfo[key][1]}</strong><p>${imageInfo[key][2]}</p></figcaption></figure>`).join('')}</div><p class="field-hint photo-note">Examples to help estimate the mix at your site. Some residue types may need specialist handling.</p>`;
}
function splitHtml(q) {
  const values=m.fields(q).filter(f=>f.type==='number').map(f=>m.v(q.id,f.key));
  const total=values.reduce((n,v)=>n+(Number(v)||0),0), started=values.some(v=>v!=='');
  return `<div class="split-check ${started&&Math.abs(total-100)>.01?'incomplete':''}" id="split-check" aria-live="polite"><span>Container mix</span><strong>${m.format(total)} / 100%</strong><div class="split-track"><span style="width:${Math.min(100,Math.max(0,total))}%"></span></div><small>${!started?'Enter your approximate shares above.':Math.abs(total-100)<.01?'Total: 100%.':total>100?`Reduce the total by ${m.format(total-100)}%.`:`${m.format(100-total)}% left to allocate.`}</small></div>`;
}
function questionHtml(q, index) {
  const hint=typeof q.hint==='function'?q.hint():q.hint, unknown=m.state.unknown[q.id];
  return `<article class="question ${unknown?'is-unknown':''}" id="question-${q.id}" tabindex="-1" aria-labelledby="title-${q.id}"><div class="qhead"><span class="qnum">${String(index+1).padStart(2,'0')}</span><div><h2 id="title-${q.id}">${esc(m.title(q))}</h2>${hint?`<p class="qdesc">${esc(hint)}</p>`:''}</div><span class="question-code">${q.id}</span></div>${m.revisionNotes().filter(note=>note.id===q.id).map(note=>`<p class="revision-note">${esc(note.message)}</p>`).join('')}${illustrations(q)}${q.kind==='shifts'?shiftHtml():`<div class="fieldgrid">${m.fields(q).map(f=>input(q,f)).join('')}</div>`}${q.split&&!unknown?splitHtml(q):''}${q.kind==='severity'?`<div class="severity-mix" id="severity-mix">${severityMix()}</div>`:''}<div class="question-bottom">${!['G02','O01'].includes(q.id)?`<label class="unknown"><input id="unknown-${q.id}" type="checkbox" data-unknown="${q.id}" ${unknown?'checked':''}> ${unknown?'Marked for discussion with MCS':'Not known / discuss with MCS'}</label>`:'<span class="field-hint">* Required to prepare your proposal</span>'}<details ${m.state.comments[q.id]?'open':''}><summary>Add a note <span>+</span></summary><label class="sr-only" for="comment-${q.id}">Additional note for ${esc(m.title(q))}</label><textarea id="comment-${q.id}" data-comment="${q.id}" maxlength="5000" placeholder="Estimates, exceptions, or anything else we should know…">${esc(m.state.comments[q.id]||'')}</textarea></details></div></article>`;
}
function severityMix() { const n=m.number('O10','heavy'); return n===null||n<0||n>100?'Add a percentage to see your estimated wash mix.':`<span><b>${m.format(100-n)}%</b> regular contamination</span><span><b>${m.format(n)}%</b> heavy contamination</span>`; }
function pretty(q) {
  if (m.state.unknown[q.id]) return 'Not known / to discuss with MCS';
  if (q.kind==='shifts') return m.rows().map((r,i)=>`Shift ${i+1} (${m.shiftPeriods.find(([key])=>key===r.period)?.[1]||'timing not supplied'}): ${m.shiftFields().map(([key,label,u])=>`${label}: ${r[key]??'' ? r[key] : r[key]===0?'0':'not supplied'} ${u}`).join('; ')}`).join('\n');
  return m.fields(q).map(f=>{
    const value=m.v(q.id,f.key); if(value===''||Array.isArray(value)&&!value.length)return '';
    const label=key=>f.options?.find(o=>o[0]===key)?.[1]||key;
    const text=['radio','multi'].includes(f.type)?(Array.isArray(value)?value.map(label).join(', '):label(value)):value;
    return `${f.label}: ${text}${f.unit?' '+unit(f):''}`;
  }).filter(Boolean).join('\n');
}
function exportData() {
  const all=m.qs();
  return {format:'mcs-container-wash-assessment-v3.1',created_at:new Date().toISOString(),submission_id:submissionId||null,answers:m.activeAnswers(),comments:Object.fromEntries(all.filter(q=>m.state.comments[q.id]).map(q=>[q.id,m.state.comments[q.id]])),questions:all.map(q=>({id:q.id,title:m.title(q),response:pretty(q),comment:m.state.comments[q.id]||''})),derived:m.derived(),validation:[...m.errors().map(e=>e.message),...m.warnings()],assumptions:{annualisation:'Average month × 12, pending site confirmation',staff:'Released time is separate from verified payroll savings.',handling:'Combined machine-and-operator cost; shift cost is divided by the supplied shift hours. Do not add handling already included in an all-in baseline.',wastewater:'Use attributable costs once; fixed costs may not fall with consumption.',missing:'Unknown financial inputs remain missing, never zero.',cleaning_time:'Elapsed time from cycle start until the container is clean. Not treated as staff working time.',pricing:'MCS validates capacity, deployment, service costs and commercial terms before quoting.'}};
}
function download() {
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`MCS-assessment-${String(m.v('G02','site')||'draft').replace(/[^a-z0-9-]/gi,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Your assessment has been downloaded.');
}
function reviewHtml() {
  const d=m.derived(), warnings=m.warnings(), errors=m.errors(), all=m.qs();
  const unknown=all.filter(q=>m.state.unknown[q.id]).length, withAnswers=all.filter(q=>!m.state.unknown[q.id]&&m.answered(q)).length;
  return `<div class="review-overview"><div><h2>Response summary</h2><p>${withAnswers} ${withAnswers===1?'question':'questions'} with information · ${unknown} to discuss · ${all.length-withAnswers-unknown} left blank</p></div><div class="review-tools"><button class="btn" data-action="export">Download answers ↓</button><button class="btn" data-action="print">Print / save PDF ↗</button></div></div>
  ${errors.length?`<div class="callout error-summary" role="${showErrors?'alert':'region'}" aria-label="Inputs to check"><strong>Check these entries</strong><ul>${errors.map(e=>`<li><button class="text-btn" data-error-q="${e.id}" data-error-key="${e.key}">${esc(e.message)} ↗</button></li>`).join('')}</ul></div>`:''}
  ${warnings.length?`<details class="callout warning"><summary>${warnings.length} consistency ${warnings.length===1?'check':'checks'} to review</summary><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul><p>Estimates can vary. Add a note where useful; MCS will review these with you.</p></details>`:''}
  <div class="metrics"><div><span>${m.model()==='none'?'Potential':'Current'} containers cleaned / month</span><strong>${m.format(d.monthly_washes)}</strong></div><div><span>Containers / operating day</span><strong>${m.format(d.average_washes_per_operating_day)}</strong></div><div><span>Assessment currency</span><strong>${esc(m.currency()==='currency'?'—':m.currency())}</strong></div></div>
  ${m.sections.map((s,i)=>{const list=s.questions.filter(m.visible);return list.length?`<section class="review-group"><div class="review-group-head"><h2><span>0${i+1}</span> ${esc(sectionNames[i])}</h2><button class="text-btn" data-step="${i}">Edit section ↗</button></div>${list.map(q=>`<div class="answer"><div class="answer-label"><span class="question-code">${q.id}</span><strong>${esc(m.title(q))}</strong><button class="edit-link" data-step="${i}" data-anchor="${q.id}">Edit answer</button></div><div class="answer-value ${!m.answered(q)?'not-supplied':''}">${esc(pretty(q)||'Not supplied')}${m.state.comments[q.id]?`<p class="review-comment">Note: ${esc(m.state.comments[q.id])}</p>`:''}</div></div>`).join('')}</section>`:''}).join('')}
  <details class="method-note"><summary>How MCS uses these answers <span>+</span></summary><div><p>We compare your current wash cost with the proposed robotic operation, including costs that remain with your site. An all-in cost is counted once; contractor invoices form the outsourced baseline.</p><p>Staff time released, additional demand and optional services are considered separately from direct cash savings. Blank amounts stay unknown until we agree assumptions with you.</p><p>MCS will confirm the site layout, robot capacity, staffing, utility requirements and implementation costs before preparing a pricing proposal. This assessment is not a quotation or a commitment to purchase.</p></div></details>
  <section class="submit-panel" id="submit-panel"><div><h2>Send assessment to MCS</h2><p>MCS will review the data, confirm any missing information and prepare a business case and pricing proposal.</p></div><div class="submit-side"><p>By submitting, you share these answers and contact details with MCS Robotics for this assessment and follow-up.</p><input name="bot-field" id="bot-field" class="honeypot" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="btn primary" data-action="submit" ${sending?'disabled':''}>${sending?'Sending your assessment…':'Submit assessment'} <span>↗</span></button><p class="field-hint">You can leave estimates and unknowns for discussion.</p>${isLocal()?'<p class="local-note">Local preview: submission becomes available after Netlify setup. You can download your answers now.</p>':''}${submissionError?`<p class="submission-error" role="alert">${esc(submissionError)}</p>`:''}</div></section>`;
}
function successHtml() {
  return `<section class="success-panel"><span class="success-mark" aria-hidden="true">✓</span><h1>Assessment submitted</h1><p>Your assessment for <strong>${esc(m.v('G02','site'))}</strong> has been submitted to MCS Robotics. We’ll review your answers and follow up at <strong>${esc(m.v('G02','email'))}</strong> to discuss your site-specific business case and pricing proposal.</p><p class="field-hint">Reference: ${esc(submitted.id)}</p><div class="button-row"><button class="btn primary" data-action="export">Download your answers ↓</button><button class="btn" data-action="review-submitted">View submitted answers</button></div></section>`;
}
let showSubmittedReview=false;
function render() {
 const isReview=step===m.reviewStep, success=submitted&&!showSubmittedReview;
 const section=m.sections[step], list=section?.questions.filter(m.visible)||[];
 document.title=`${success?'Assessment submitted':isReview?'Review your assessment':sectionNames[step]} | MCS Robotics`;
 document.getElementById('app').innerHTML=`<div class="layout" aria-busy="${sending}" ${sending?'inert':''}><aside class="sidebar"><a class="brand" href="https://www.mcsrobotics.com/" target="_blank" rel="noopener noreferrer" aria-label="MCS Robotics website, opens in a new tab"><img src="assets/MCS_Robotics_logo_orange_white.png" alt="MCS Robotics" width="205" height="52"></a><div class="sidebar-label">Site assessment <span>01—04</span></div><nav class="nav" aria-label="Assessment sections">${sectionNames.map((name,i)=>`<button data-step="${i}" class="${step===i?'active':''}" ${step===i?'aria-current="step"':''}><span class="nav-num">${i===4?'↗':String(i+1).padStart(2,'0')}</span><span><strong>${name}</strong><small>${sectionDescriptions[i]}</small></span></button>`).join('')}</nav><div class="side-help"><span class="eyebrow">Assessment support</span><p>Contact MCS if you need help completing this form.</p><a href="mailto:fabian@mcsrobotics.com">Contact MCS ↗</a></div><div class="sidebar-bottom"><span data-storage>${storageOK?'Draft saved on this device':'Draft not saved — download a copy'}</span><small>Answers are shared only when you submit.</small><button class="text-btn" data-action="export">Download draft ↓</button><button class="text-btn reset-link" data-action="reset">Start again</button></div></aside><main id="main-content" class="main" tabindex="-1"><header class="topbar"><span>CONTAINER CLEANING <span class="topbar-slash">/</span> SITE ASSESSMENT</span><a href="https://www.mcsrobotics.com/" target="_blank" rel="noopener noreferrer">MCS ROBOTICS ↗</a></header><div class="mobile-nav"><label for="section-jump">Your assessment</label><select id="section-jump">${sectionNames.map((name,i)=>`<option value="${i}" ${step===i?'selected':''}>${i===4?'Review':`0${i+1}`} · ${esc(name)}</option>`).join('')}</select></div>
 ${success?`<div class="shell">${successHtml()}</div>`:`${step===0?`<section class="hero hero-intro"><div class="hero-copy"><div class="eyebrow">MCS Robotics / Operations</div><h1 id="page-title" tabindex="-1">Container<br>cleaning<br><span>assessment</span></h1><p>This form collects operating data for MCS to assess robotic container cleaning and prepare a business case and pricing proposal.</p><div class="hero-meta"><span>4 sections</span><span>Estimates welcome</span></div></div><div class="hero-visual"><img src="assets/floored-containers.jpg" alt="Rows of containers at a terminal" fetchpriority="high"></div></section>`:`<section class="hero section-hero"><div class="eyebrow">${isReview?'Your assessment':`Section 0${step+1} / 04`}</div><h1 id="page-title" tabindex="-1">${isReview?'Review assessment':esc(sectionNames[step])}</h1><p>${isReview?'Review your answers, then send them to MCS. You can return to any section to make changes.':esc(section.desc)}</p></section>`}
 <div class="shell"><div class="section-top"><div class="section-kicker"><span>${isReview?'05':String(step+1).padStart(2,'0')}</span><span class="kicker-line"></span><strong>${isReview?'Review & submit':esc(sectionNames[step])}</strong></div><span class="section-hint">${step===0?'Approx. 15–25 min for the full assessment':isReview?'Check before submitting':`${list.length} ${list.length===1?'question':'questions'} · estimates are welcome`}</span></div>${step===0?`<div class="welcome-note"><p>Have typical cleaning volumes and operating costs available, if known. You can leave unknown figures blank or mark them for discussion.</p><p>Your draft is saved in this browser so you can come back later on the same device. Use one assessment per site and wash arrangement.</p></div>`:''}${isReview?reviewHtml():`${step>1&&!m.model()?'<div class="callout">First, <button class="text-btn" data-step="1" data-anchor="O01">choose your current cleaning arrangement ↗</button> so we can show the relevant questions.</div>':''}${list.map(questionHtml).join('')}`}
 <div class="mobile-tools"><span data-storage>${storageOK?'Draft saved on this device':'Draft not saved — download a copy'}</span><div><button class="text-btn" data-action="export">Download draft ↓</button><button class="text-btn" data-action="reset">Start again</button></div></div><div class="foot"><button class="btn" data-action="back" ${step===0?'disabled':''}>← Back</button><span>${isReview?'Review & submit':`Section ${step+1} of 4`}</span>${isReview?'<button class="btn" data-action="to-submit">Go to submission ↓</button>':`<button class="btn primary" data-action="next">${step===3?'Review my answers':'Continue'} <span>→</span></button>`}</div></div>`}
 <footer class="page-footer"><span>MCS ROBOTICS <span class="footer-divider">/</span> CONTAINER CLEANING ASSESSMENT</span><a href="mailto:fabian@mcsrobotics.com">Contact MCS ↗</a><button class="text-btn" data-action="privacy">About your data</button></footer><div class="data-note" id="data-note" hidden><strong>About your data</strong><p>Your draft is stored in this browser. Other people using this browser profile may be able to access it; use “Start again” to clear it. When you submit, your answers and contact details are sent to MCS Robotics through our form hosting provider, Netlify, for assessment and follow-up. Contact <a href="mailto:fabian@mcsrobotics.com">fabian@mcsrobotics.com</a> about your information.</p></div></main></div>`;
}
function renderPreservingFocus() {
 const active=document.activeElement, id=active?.id, scroll=window.scrollY;
 const openNotes=[...document.querySelectorAll('.question details[open]')].map(d=>d.closest('.question').id);
 render();
 for(const qid of openNotes)document.querySelector(`#${qid} details`)?.setAttribute('open','');
 window.scrollTo(0,scroll);if(id)document.getElementById(id)?.focus({preventScroll:true});
}
function go(next,anchor) {
 step=Math.max(0,Math.min(m.reviewStep,next));showSubmittedReview=!!submitted;persist();render();
 const target=anchor?document.getElementById(`question-${anchor}`):document.getElementById('page-title');
 if(anchor)target?.scrollIntoView({block:'start'});else window.scrollTo(0,0);
 target?.focus({preventScroll:true});
 document.getElementById('announcement').textContent=`${sectionNames[step]}. ${step===m.reviewStep?'Review and submit your assessment.':`Section ${step+1} of 4.`}`;
}
function update(el,rerender=false) {
 if(el.dataset.comment){m.setComment(el.dataset.comment,el.value);changed();return;}
 if(el.dataset.shift!==undefined){const rows=m.rows().map(r=>({...r}));rows[+el.dataset.shift][el.dataset.skey]=el.value;m.setAnswer('L01','rows',rows);changed();return;}
 if(!el.dataset.q)return;
 const id=el.dataset.q,key=el.dataset.key;
 if(el.type==='checkbox'){
  let values=Array.isArray(m.v(id,key))?[...m.v(id,key)]:[];
  const f=m.fields(m.qs().find(q=>q.id===id)).find(f=>f.key===key);
  if(el.checked){
   if(['none','unknown'].includes(el.value))values=[];else values=values.filter(x=>!['none','unknown'].includes(x));
   if(f.limit&&values.length>=f.limit){el.checked=false;toast(`Choose up to ${f.limit} priorities. Deselect one to choose another.`);return;}
   values.push(el.value);
  }else values=values.filter(x=>x!==el.value);
  m.setAnswer(id,key,values);
 }else m.setAnswer(id,key,el.value);
 changed();
 if(rerender)renderPreservingFocus();
 else if(id==='O08'){const q=m.qs().find(q=>q.id==='O08');const check=document.getElementById('split-check');if(check)check.outerHTML=splitHtml(q);}
 else if(id==='O10'){const mix=document.getElementById('severity-mix');if(mix)mix.innerHTML=severityMix();}
}
async function submit() {
 if(sending)return;
 showErrors=true;
 if(m.errors().length){render();document.querySelector('.error-summary')?.scrollIntoView({block:'center'});toast('Check the highlighted details before submitting.');return;}
 if(isLocal()){toast('This is a local preview. Download your answers, or submit after Netlify is configured.');return;}
 if(document.getElementById('bot-field')?.value)return;
 if(document.querySelector('form[name="mcs-assessment"]')?.hasAttribute('data-netlify')){submissionError='This form is not ready to receive submissions yet. Please download your answers and contact MCS.';render();document.getElementById('submit-panel')?.scrollIntoView({block:'center'});return;}
 if(submitted){showSubmittedReview=false;render();window.scrollTo(0,0);return;}
 sending=true;document.getElementById('announcement').textContent='Sending your assessment. Please wait.';submissionError='';submissionId ||= crypto.randomUUID();persist();render();
 const data=exportData();
 const payload=new URLSearchParams({'form-name':'mcs-assessment','bot-field':'',company:m.v('G02','company'),site:m.v('G02','site'),name:m.v('G02','contact'),email:m.v('G02','email'),submission_id:submissionId,version:'3.1',assessment_summary:data.questions.map(q=>`${q.id} — ${q.title}\n${q.response||'Not supplied'}${q.comment?'\nNote: '+q.comment:''}`).join('\n\n'),assessment_json:JSON.stringify(data)});
 try {
  const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:payload.toString(),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  submitted={id:submissionId,at:new Date().toISOString()};showSubmittedReview=false;persist();
 }catch{
  submissionError='We couldn’t confirm receipt. Your answers are still here. Please try again, or download your answers and contact fabian@mcsrobotics.com. If you retry, the same reference helps MCS identify duplicates.';
 }finally{
  sending=false;render();
  if(submitted){window.scrollTo(0,0);document.querySelector('.success-panel h1')?.setAttribute('tabindex','-1');document.querySelector('.success-panel h1')?.focus();}
  else document.getElementById('submit-panel')?.scrollIntoView({block:'center'});
 }
}
document.addEventListener('input',e=>{if(!['radio','checkbox'].includes(e.target.type)&&e.target.tagName!=='SELECT')update(e.target);});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.id==='section-jump'){go(+el.value);return;}
 if(el.dataset.unknown){m.setUnknown(el.dataset.unknown,el.checked);changed();renderPreservingFocus();return;}
 update(el,['radio','checkbox'].includes(el.type)||el.tagName==='SELECT'||(el.dataset.q==='O08'&&el.dataset.key==='oog'));
});
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-action],[data-step],[data-photo],[data-error-q]');if(!el)return;
 if(el.dataset.step!==undefined){go(+el.dataset.step,el.dataset.anchor);return;}
 if(el.dataset.errorQ){showErrors=true;const id=el.dataset.errorQ;go(m.sections.findIndex(s=>s.questions.some(q=>q.id===id)),id);(document.getElementById(el.dataset.errorKey.startsWith('shift-')?el.dataset.errorKey:`${id}-${el.dataset.errorKey}`)||document.querySelector(`#question-${id} input`))?.focus({preventScroll:true});return;}
 if(el.dataset.photo){const [src,title,alt]=imageInfo[el.dataset.photo];document.getElementById('photo-title').textContent=title;document.getElementById('photo-large').src=src;document.getElementById('photo-large').alt=alt;document.getElementById('photo-dialog').showModal();return;}
 const action=el.dataset.action;
 if(action==='next')go(step+1);
 if(action==='back')go(step-1);
 if(action==='export')download();
 if(action==='print')window.print();
 if(action==='submit')submit();
 if(action==='to-submit')document.getElementById('submit-panel')?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 if(action==='privacy'){const note=document.getElementById('data-note');note.hidden=!note.hidden;if(!note.hidden)note.scrollIntoView({block:'center'});}
 if(action==='reset')document.getElementById('reset-dialog').showModal();
 if(action==='cancel-reset')document.getElementById('reset-dialog').close();
 if(action==='confirm-reset'){m.reset();submitted=null;submissionId='';showErrors=false;submissionError='';showSubmittedReview=false;try{localStorage.removeItem(LEGACY_STORAGE);}catch{}document.getElementById('reset-dialog').close();go(0);toast('Your local draft has been cleared.');}
 if(action==='close-photo')document.getElementById('photo-dialog').close();
 if(action==='review-submitted'){showSubmittedReview=true;go(m.reviewStep);}
 if(action==='add-shift'||action==='remove-shift'){
  const rows=m.rows().map(r=>({...r}));
  if(action==='add-shift'&&rows.length<6)rows.push({people:'',hours:'',washes:'',allocation:'100'});
  if(action==='remove-shift'&&rows.length>1)rows.splice(+el.dataset.index,1);
  m.setAnswer('L01','rows',rows);changed();renderPreservingFocus();
  if(action==='add-shift')document.getElementById(`shift-${rows.length-1}-period`)?.focus();
 }
});
let printStep=null, printReview=false;
window.addEventListener('beforeprint',()=>{printStep=step;printReview=showSubmittedReview;step=m.reviewStep;showSubmittedReview=true;render();});
window.addEventListener('afterprint',()=>{if(printStep!==null){step=printStep;showSubmittedReview=printReview;printStep=null;render();}});
render();
