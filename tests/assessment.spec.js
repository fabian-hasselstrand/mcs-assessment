import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
const contact={company:'QA Port',site:'QA Terminal',country:'Sweden',currency:'SEK',contact:'QA Director',email:'qa@example.com'};
async function seed(page, answers={}, step=0, extra={}) {
 await page.addInitScript(data=>localStorage.setItem('mcs-wash-assessment-v3',JSON.stringify(data)),{answers:{G02:contact,...answers},step,...extra});
 await page.goto('/');
}
async function nav(page,step){await page.locator(`.nav [data-step="${step}"]`).click();}
async function radio(page,id,key,value){await page.locator(`[data-q="${id}"][data-key="${key}"][value="${value}"]`).check();}
const models=['internal','external_on','external_off','none'];
for(const model of models)test(`${model}: complete navigation and branch changes`,async({page})=>{
 await seed(page);await page.getByRole('button',{name:'Continue',exact:false}).click();await radio(page,'O01','model',model);
 if(model==='none'){await expect(page.locator('#question-O02')).toHaveCount(0);await expect(page.locator('#question-O03')).toHaveCount(0);}
 else{await radio(page,'O02','position','ground');await expect(page.locator('#question-O03')).toBeVisible();await radio(page,'O02','position','chassis');await expect(page.locator('#question-O03')).toHaveCount(0);}
 await page.locator('#O04-monthly').fill('400');await page.locator('#O04-days').fill('20');
 await page.locator('#O08-dry20').fill('40');await page.locator('#O08-dry40').fill('60');await expect(page.locator('#split-check')).toContainText('Total: 100%.');
 await page.locator('#O10-heavy').fill('25');await expect(page.locator('#severity-mix')).toContainText('75%');
 await nav(page,2);await expect(page.locator('#question-F03')).toHaveCount(model.startsWith('external')?1:0);await expect(page.locator('#question-L02')).toHaveCount(model==='internal'?1:0);
 await page.locator('#shift-0-hours').fill('8');await page.getByRole('button',{name:'+ Add another shift'}).click();await expect(page.locator('#shift-1-hours')).toBeVisible();
 await page.getByRole('button',{name:'Remove shift 2'}).click();await expect(page.locator('#shift-1-hours')).toHaveCount(0);
 await nav(page,3);await radio(page,'V05','services','drying');await expect(page.locator('#question-V06')).toBeVisible();
 await radio(page,'V05','services','none');await expect(page.locator('#question-V06')).toHaveCount(0);
 await nav(page,4);await expect(page.locator('.error-summary')).toHaveCount(0);await expect(page.locator('.metrics')).toContainText('400');
 await page.getByRole('button',{name:'Submit assessment'}).click();await expect(page.locator('#toast')).toContainText('local preview');
});
test('photo cards use supplied images and contamination lightbox works',async({page})=>{
 await seed(page,{O01:{model:'internal'}},1);
 for(const file of ['floored-containers.jpg','chassi-containers.jpg','normal-contamination.PNG','heavy-contamination.PNG']){
  const img=page.locator(`.question img[src$="${file}"]`);await img.scrollIntoViewIfNeeded();await expect(img).toBeVisible();await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
 }
 await page.getByRole('button',{name:'Enlarge heavy contamination photo'}).click();await expect(page.locator('#photo-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#photo-dialog')).not.toBeVisible();
});
test('drafts and notes survive reload; partial questions are not labelled complete',async({page})=>{
 await page.goto('/');await page.locator('#G02-company').fill('Example company');await page.getByText('Add a note',{exact:false}).click();await page.locator('#comment-G02').fill('A useful note');await page.reload();
 await expect(page.locator('#G02-company')).toHaveValue('Example company');await expect(page.locator('#comment-G02')).toHaveValue('A useful note');await nav(page,4);await expect(page.locator('.review-overview')).toContainText('1 question with information');await expect(page.locator('.error-summary')).toContainText('work email');
});
test('exclusive services and three-priority limit work with keyboard focus retained',async({page})=>{
 await seed(page,{O01:{model:'internal'}},3);await radio(page,'V05','services','inspection');await radio(page,'V05','services','drying');await radio(page,'V05','services','unknown');
 await expect(page.locator('#V05-services-inspection')).not.toBeChecked();await expect(page.locator('#V05-services-unknown')).toBeFocused();
 for(const choice of ['cost','safety','capacity','quality'])await page.locator(`#V09-priorities-${choice}`).click();
 await expect(page.locator('#V09-priorities-quality')).not.toBeChecked();await expect(page.locator('#toast')).toContainText('up to 3');
});
test('export includes current branches, notes, zero values and warnings',async({page})=>{
 await seed(page,{O01:{model:'external_off'},F03:{average_cost:'0'},F01:{known:'yes',cost:'999'}},4,{comments:{F03:'Invoice estimate',F01:'Hidden note'}});
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download answers',exact:false}).click()]);
 const data=JSON.parse(await readFile(await download.path(),'utf8'));expect(data.answers.F03.average_cost).toBe('0');expect(data.answers.F01).toBeUndefined();expect(data.comments.F03).toBe('Invoice estimate');expect(data.comments.F01).toBeUndefined();
});
test('errors link to a field and invalid values cannot submit',async({page})=>{
 await seed(page,{O01:{model:'internal'},O08:{dry20:'70',dry40:'50'}},4);await page.getByRole('button',{name:'Submit assessment'}).click();await page.getByRole('button',{name:/Container shares should total/}).click();await expect(page.locator('#O08-dry20')).toBeFocused();await expect(page.locator('#O08-dry20')).toHaveAttribute('aria-invalid','true');
});
test('start again supports cancel and clear',async({page})=>{
 await seed(page);await page.getByRole('button',{name:'Start again',exact:true}).click();await page.getByRole('button',{name:'Keep my answers'}).click();await expect(page.locator('#G02-company')).toHaveValue('QA Port');
 await page.getByRole('button',{name:'Start again',exact:true}).click();await page.getByRole('button',{name:'Clear & start again'}).click();await expect(page.locator('#G02-company')).toHaveValue('');
});
test('stored legacy answers migrate and printing includes every visible section',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('mcs-wash-assessment-v2.3',JSON.stringify({answers:{G02:{company:'Legacy'},O01:{model:'none'}},step:0})));
 await page.goto('/');await expect(page.locator('#G02-company')).toHaveValue('Legacy');await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));await page.emulateMedia({media:'print'});await expect(page.locator('.review-group')).toHaveCount(4);await expect(page.locator('.submit-panel')).not.toBeVisible();await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
});
for(const width of [375,768,1024,1440])test(`responsive layout and accessibility at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await seed(page,{O01:{model:'internal'},O02:{position:'ground'}},0);
 for(const step of [0,1,2,3,4]){
  if(width<=900)await page.locator('#section-jump').selectOption(String(step));else await nav(page,step);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);
  if(step===0)await page.screenshot({path:`test-results/design-${width}.png`});
  if(step===1&&width!==768){await page.locator('#question-O02').screenshot({path:`test-results/positions-${width}.png`});await page.locator('#question-O10').scrollIntoViewIfNeeded();await page.locator('#question-O10 img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));await page.locator('#question-O10').screenshot({path:`test-results/contamination-${width}.png`});}
 }
});
test('blocked browser storage still allows editing and export',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage unavailable')};});await page.goto('/');await page.locator('#G02-company').fill('Unsaved Port');await expect(page.locator('[data-storage]:visible')).toContainText('not saved');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download draft'}).click()]);expect(JSON.parse(await readFile(await download.path(),'utf8')).answers.G02.company).toBe('Unsaved Port');
});
// Simulate the hosting boundary entirely in the test; no submissions leave this machine.
for(const outcome of ['success','failure'])test(`submission ${outcome} with a mocked Netlify endpoint`,async({page})=>{
 const base='https://assessment.example.test';let posted;
 await page.route(`${base}/**`,async route=>{
  const req=route.request();
  if(req.method()==='POST'){posted=new URLSearchParams(req.postData());await route.fulfill({status:outcome==='success'?200:500,contentType:'text/plain',body:outcome==='success'?'Received':'Error'});return;}
  const path=new URL(req.url()).pathname;const res=await page.request.get(`http://127.0.0.1:4173${path}`);if(path==='/'){await route.fulfill({response:res,body:(await res.text()).replace('data-netlify="true"','')});}else await route.fulfill({response:res});
 });
 await page.addInitScript(data=>localStorage.setItem('mcs-wash-assessment-v3',JSON.stringify(data)),{answers:{G02:contact,O01:{model:'none'}},step:4});
 await page.goto(base);await page.getByRole('button',{name:'Submit assessment'}).click();
 if(outcome==='success')await expect(page.locator('.success-panel')).toContainText('QA Terminal');else await expect(page.locator('.submission-error')).toContainText('couldn’t confirm receipt');
 expect(posted.get('form-name')).toBe('mcs-assessment');expect(posted.get('email')).toBe('qa@example.com');expect(JSON.parse(posted.get('assessment_json')).answers.O01.model).toBe('none');expect(posted.get('assessment_summary')).toContain('Which company');
});
test('a deployed page with unprocessed form markup never reports success',async({page})=>{
 let posted=false;
 await page.route('https://unconfigured.example.test/**',async route=>{
  if(route.request().method()==='POST'){posted=true;await route.fulfill({status:200,body:'fallback'});return;}
  await route.fulfill({response:await page.request.get(`http://127.0.0.1:4173${new URL(route.request().url()).pathname}`)});
 });
 await page.addInitScript(data=>localStorage.setItem('mcs-wash-assessment-v3',JSON.stringify(data)),{answers:{G02:contact,O01:{model:'none'}},step:4});
 await page.goto('https://unconfigured.example.test');await page.getByRole('button',{name:'Submit assessment'}).click();await expect(page.locator('.submission-error')).toContainText('not ready to receive');expect(posted).toBe(false);await expect(page.locator('.success-panel')).toHaveCount(0);
});
test('pending submission prevents edits and repeated submission',async({page})=>{
 let release;let requests=0;const responseGate=new Promise(resolve=>{release=resolve});
 await page.route('https://pending.example.test/**',async route=>{
  if(route.request().method()==='POST'){requests++;await responseGate;await route.fulfill({status:200,body:'received'});return;}
  const res=await page.request.get(`http://127.0.0.1:4173${new URL(route.request().url()).pathname}`);
  if(new URL(route.request().url()).pathname==='/'){await route.fulfill({response:res,body:(await res.text()).replace('data-netlify="true"','')});}else await route.fulfill({response:res});
 });
 await page.addInitScript(data=>localStorage.setItem('mcs-wash-assessment-v3',JSON.stringify(data)),{answers:{G02:contact,O01:{model:'none'}},step:4});
 await page.goto('https://pending.example.test');await page.getByRole('button',{name:'Submit assessment'}).click();await expect(page.locator('.layout')).toHaveAttribute('inert','');await expect(page.locator('[data-action="submit"]')).toBeDisabled();release();await expect(page.locator('.success-panel')).toBeVisible();expect(requests).toBe(1);await page.unrouteAll({behavior:'wait'});
});

test('revised chemical, container and handling fields export the current data',async({page})=>{
 await seed(page,{O01:{model:'internal'},O02:{position:'ground',future:'no',future_detail:'Old layout'},F04:{average_price:'500'}},1,{comments:{F04:'Retired selling price'}});
 await expect(page.locator('[data-key="future"]')).toHaveCount(0);
 await radio(page,'O06','chemicals','yes');await page.locator('#O06-chemical_share').fill('35');
 await page.locator('#O08-dry20').fill('70');await page.locator('#O08-oog').fill('30');await page.locator('#O08-oog').blur();
 await page.locator('#O08-oog_details').fill('Flat racks');await expect(page.locator('#split-check')).toContainText('100%');
 await page.locator('#O10-heavy').fill('20');await nav(page,2);
 await expect(page.locator('#question-L01')).toContainText('wages, employer contributions, benefits and shift premiums');
 await page.locator('#L02-cycle_regular').fill('15');await page.locator('#L02-cycle_heavy').fill('30');
 await expect(page.locator('#L03-minutes')).toHaveCount(0);await page.locator('#L03-bottleneck_details').fill('Reach-stacker availability.');
 await page.locator('#H01-handling_hours').fill('4');await radio(page,'H01','cost_basis','shift');await page.locator('#H01-shift_cost').fill('6000');await page.locator('#H01-shift_hours').fill('8');
 await expect(page.locator('#question-F04')).toHaveCount(0);
 await nav(page,3);await radio(page,'V05','services','recycling');await page.locator('#V05-recycling_requirements').fill('Lower discharge volumes.');
 await nav(page,4);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download answers',exact:false}).click()]);
 const data=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(data.derived.chemical_use_percent).toBe(35);expect(data.answers.O08.oog).toBe('30');expect(data.derived.reach_stacker_combined_hourly_cost).toBe(750);
 expect(data.answers.L03).toEqual({bottleneck_details:'Reach-stacker availability.'});expect(data.answers.O02.future).toBeUndefined();
 expect(data.answers.F04).toBeUndefined();expect(data.comments.F04).toBeUndefined();expect(data.answers.V05.services).toContain('recycling');
 expect(data.format).toBe('mcs-container-wash-assessment-v3.1');
});
test('changing to no current operation hides layout, cycle and handling questions',async({page})=>{
 await seed(page,{O01:{model:'internal'},O02:{position:'ground'},H01:{cost_basis:'hour',hourly_cost:'400'},L02:{cycle_regular:'20'}},1);
 await radio(page,'O01','model','none');await expect(page.locator('#question-O02')).toHaveCount(0);await expect(page.locator('#question-O03')).toHaveCount(0);
 await nav(page,2);for(const id of ['L02','L03','H01','F04'])await expect(page.locator(`#question-${id}`)).toHaveCount(0);
 await nav(page,4);await expect(page.locator('.answer')).not.toContainText(['Combined machine and operator cost']);
});
test('old draft values with changed meanings are flagged instead of relabelled',async({page})=>{
 await seed(page,{O01:{model:'internal'},O02:{position:'ground'},O08:{dry20:'90',other:'10',other_type:'Tank'},L02:{regular:'10',people:'2'},H01:{machine_rate:'300',operator_rate:'100'}},1);
 await expect(page.locator('#O08-oog')).toHaveValue('');await expect(page.locator('#question-O08 .revision-note')).toContainText('10% under Other');
 await nav(page,2);await expect(page.locator('#L02-cycle_regular')).toHaveValue('');await expect(page.locator('#question-L02 .revision-note')).toBeVisible();await expect(page.locator('#question-H01 .revision-note')).toBeVisible();
});
