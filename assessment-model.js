// Assessment questions, branching, baseline indicators and validation.
export function createAssessmentModel(initial = {}) {
 let answers = initial.answers || {}, comments = initial.comments || {}, unknown = initial.unknown || {};
 const a = id => unknown[id] ? {} : (answers[id] || {});
 const v = (id, key) => a(id)[key] ?? '';
 const has = (id, key, value) => Array.isArray(v(id, key)) && v(id, key).includes(value);
 const model = () => v('O01', 'model');
 const internal = () => model() === 'internal';
 const external = () => ['external_on', 'external_off'].includes(model());
 const current = () => !!model() && model() !== 'none';
 const ground = () => current() && v('O02', 'position') === 'ground';
 const currency = () => v('G02', 'currency') === 'Other' ? (v('G02', 'other_currency') || 'currency') : (v('G02', 'currency') || 'currency');
 const format = n => n == null || !Number.isFinite(n) ? '—' : Number(n.toFixed(2)).toLocaleString('en-GB');
const F=(key,label,type='text',extra={})=>({key,label,type:typeof type==='object'?'text':type,...(typeof type==='object'?type:extra)});
const N=(key,label,unit='',extra={})=>F(key,label,'number',{unit,...extra});
const R=(key,label,options,extra={})=>F(key,label,'radio',{options,...extra});
const M=(key,label,options,extra={})=>F(key,label,'multi',{options,...extra});
const T=(key,label,extra={})=>F(key,label,'textarea',extra);
const yesno=[['yes','Yes'],['no','No'],['unsure','Not sure']];
const costItems=[['labour','Wash personnel'],['water','Water'],['energy','Power / water heating'],['chemicals','Chemicals / consumables'],['wastewater','Wastewater'],['equipment','Wash equipment / maintenance'],['overhead','Other wash overhead']];
const incl=k=>has('F01','included',k);
const itemFields=()=>{
 const known=v('F01','known')==='yes';
 const fields=[N('water','Fresh-water supply rate','per m³',{hint:'Use the water tariff excluding wastewater charges where possible. Leave blank if unknown.'}),R('water_includes_sewer','Does that water rate already include sewer / wastewater charges?',yesno)];
 const items=[['energy','Power and water-heating cost'],['chemicals','Cleaning chemicals / consumables'],['equipment','Wash equipment, maintenance and depreciation'],['overhead','Other attributable wash overhead']];
 for(const [key,label] of items){
  if(key==='chemicals'&&v('O06','chemicals')!=='yes')continue;
  if(known&&incl(key))continue;
  fields.push(N(key,label,'per wash',{hint:known?'Only include amounts excluded from your stated all-in cost.':'Average cost per completed wash; use 0 only if genuinely zero.'}));
 }
 return fields;
};
const Q=(id,title,fields,extra={})=>({id,title,fields,...extra});
const sections=[
{title:'About your site',desc:'Company, site and contact details.',questions:[
Q('G02','Which company and site is this assessment for?',[
F('company','Company',{required:true,autocomplete:'organization'}),F('site','Terminal / depot',{required:true}),F('city','City'),F('country','Country',{required:true,autocomplete:'country-name'}),F('currency','Assessment currency','select',{required:true,options:['SEK','EUR','GBP','DKK','NOK','USD','Other']}),F('other_currency','Other currency code (e.g. AED)',{when:()=>v('G02','currency')==='Other'}),F('contact','Contact name',{required:true,autocomplete:'name'}),F('email','Work email','email',{required:true,autocomplete:'email'})],{hint:'Approximate figures are welcome throughout the assessment. Leave financial inputs blank if unknown; MCS will identify assumptions and any benchmarks in the final business case.'})]},
{title:'Cleaning operation',desc:'Monthly volumes, container types and the current cleaning setup.',questions:[
Q('O01','Who carries out the container wash today?',[
R('model','Select one operating model',[
['internal','Our own personnel'],['external_on','A contractor at our site'],['external_off','A contractor at another site'],['none','We do not currently arrange container washing']])],{hint:'For a site using several arrangements, assess one operation at a time. For contractor washing, the baseline is simply what you currently pay per wash.'}),
Q('O02','Where are containers positioned during cleaning?',[
R('position','Current container position',[['ground','On the ground / floored'],['chassis','On chassis / trailer'],['other','Other — describe']]),
T('other','Describe the setup',{when:()=>v('O02','position')==='other'})],{when:current,kind:'position',hint:'For contracted cleaning, describe the provider’s setup if known. Otherwise mark this question as not known.'}),
Q('O03','How are grounded containers arranged for washing?',[
T('layout','How many containers per row, and how many rows?',{placeholder:'For example: 8 containers per row, 2 rows; doors all face the same way.'})],{when:ground,hint:'Describe the current arrangement. Leave this blank if the layout is not known.'}),
Q('O04',()=>model()==='none'?'What monthly wash demand could a new operation serve?':'How many containers are washed in a typical month?',[
N('monthly','Containers per month','containers'),N('days','Wash operating days per month','days',{max:31})],{when:()=>!!model(),hint:'Use an average month across the year. Count containers, not TEU. For outsourced washing, enter your site’s volume only. If you have no current operation, enter realistic potential demand; it is not counted as existing revenue.'}),
Q('O05','How does wash volume fluctuate, and why?',[
T('variation','Describe busy / quiet periods and what drives them',{placeholder:'Seasonal cargo, vessel arrivals, contract changes, weather… Mention typical peak demand if known.'})],{when:()=>!!model()}),
Q('O06','How are containers cleaned?',[
R('method','Main cleaning method',[['cold','Cold water'],['hot','Hot water'],['steam','Steam'],['unsure','Not sure']]),
R('chemicals','Do you use cleaning chemicals?',yesno),
N('chemical_share','Share of containers cleaned using chemicals','%',{max:100,when:()=>v('O06','chemicals')==='yes',hint:'Estimate the percentage of all cleaned containers that require chemicals. Enter 100 if chemicals are used every time; leave blank if unknown.'}),
T('chemical_names','Which chemicals are used, and for what purpose?',{when:()=>v('O06','chemicals')==='yes',placeholder:'For example: detergent for routine cleaning or a treatment for odour.'}),
T('chemical_note','Any specialist treatment or other requirements?',{when:()=>v('O06','chemicals')==='yes'})],{when:internal,hint:'Select the main method used. Chemical costs are recorded in the costs section.'}),
Q('O07','What equipment is normally used for the wash?',[
R('equipment','Select the main equipment',[['pressure','Pressure washer'],['hose','Hose'],['fixed','Fixed wash system'],['steam','Steam equipment'],['other','Other']]),F('other','Describe the equipment',{when:()=>v('O07','equipment')==='other'})],{when:internal}),
Q('O08','What is the container mix for cleaning?',[
N('dry20','20 ft dry','%',{max:100}),N('dry40','40 ft / high-cube dry','%',{max:100}),N('reefer20','20 ft reefer','%',{max:100}),N('reefer40','40 ft / high-cube reefer','%',{max:100}),N('oog','OOG — out of gauge','%',{max:100}),F('oog_details','Describe the OOG units',{when:()=>Number(v('O08','oog'))>0})],{when:()=>!!model(),split:true,hint:'Estimate the share of each category. Count each container once; include OOG units only in the OOG category. Enter 0 for categories you do not clean. Shares should total 100%.'}),
Q('O09','What cargo do these containers generally carry?',[
T('cargo','Common cargoes',{placeholder:'For example: fruit, fish, timber, grain, paper, RDF… Include any cargo-specific wash challenges.'})],{when:()=>!!model()}),
Q('O10','What share needs more than a regular container wash?',[
N('heavy','Containers with heavy contamination','%',{max:100})],{when:()=>!!model(),kind:'severity',hint:'Estimate the share with substantial residues. The remainder is treated as regular contamination. Use the illustrative images as a guide; some residue types may require specialist handling.'}),
Q('O11','Are lingering smells a problem?',[
R('smell','Select one',yesno),T('treatment','How do you currently treat the smell?',{when:()=>v('O11','smell')==='yes',placeholder:'Treatment, chemicals used and any additional time or difficulty.'})],{when:()=>!!model()})]},
{title:'Resources & costs',desc:'Describe the resources used for washing, then their costs. Known all-in costs avoid unnecessary detail.',questions:[
Q('F01','Do you already know your current cost per container wash?',[
R('known','Select one',[['yes','Yes — we know our cost per wash'],['no','No — help calculate it']]),
N('cost','Current cost per wash','per wash',{when:()=>v('F01','known')==='yes'}),
R('basis','Basis for this amount',[['calculated','Calculated from our operation'],['estimate','Approximate estimate']],{when:()=>v('F01','known')==='yes'}),
M('included','What does this cost include?',[...costItems,['handling','Container handling / lifts']],{when:()=>v('F01','known')==='yes'}),
T('scope','Anything excluded or included as a bundled service?',{when:()=>v('F01','known')==='yes'})],
{when:internal,hint:'A known total is our baseline. We still ask about shift staffing and water consumption to model the future robotic operation, but we will not add costs again if already included here.'}),
Q('L01',()=>internal()?'How is cleaning staffed, and what does labour cost?':'What operating hours could be available for robotic cleaning?',[],
{when:()=>!!model(),kind:'shifts',hint:()=>internal()?'For each shift, enter personnel, paid hours, containers cleaned and employer cost per person-hour. Include wages, employer contributions, benefits and shift premiums in that hourly cost. If staff also do other work, estimate the share of paid time spent on cleaning. Exclude time spent on separate container handling.':'Enter the hours available in a typical day, if known. Leave blank if the operating schedule has not been decided. Contractor staffing and labour costs are not required.'}),
Q('L02','How long does a cleaning cycle take?',[
N('cycle_regular','Regular contamination','minutes / container'),N('cycle_heavy','Heavy contamination','minutes / container',{when:()=>Number(v('O10','heavy'))>0})],
{when:internal,hint:'Measure from the start of the cleaning cycle until the container is considered clean, including treatment or waiting within that cycle. Exclude queueing or positioning before the cycle and drying or handling after cleaning. This is elapsed cycle time, not staff working time.'}),
Q('L03','What limits the number of containers that can be cleaned per shift?',[
T('bottleneck_details','Main bottleneck, if any',{placeholder:'For example: cleaning cycle time, reach-stacker availability or handling speed, staffing, space, queues or contractor capacity. If there is no bottleneck, say so.'})],
{when:current,hint:'Describe where containers wait or which part of the process limits throughput. Exact timings are not required.'}),
Q('H01','What reach-stacker time and cost are allocated to cleaning?',[
R('allocation','Reach-stacker allocation',[['dedicated','Dedicated to cleaning operations'],['shared','Shared with other terminal work'],['other','Other / not sure']]),
N('handling_hours','Reach-stacker time allocated to cleaning on a typical day','hours / day',{max:24,hint:'Include time reserved for cleaning when the machine and operator cannot do other work.'}),
R('cost_basis','How can you provide the combined machine and operator cost?',[['hour','Cost per hour'],['shift','Cost per shift'],['unknown','Not known']]),
N('hourly_cost','Combined machine and operator cost','per hour',{when:()=>v('H01','cost_basis')==='hour'}),
N('shift_cost','Combined machine and operator cost','per shift',{when:()=>v('H01','cost_basis')==='shift'}),
N('shift_hours','Hours covered by that shift cost','hours',{min:0.01,max:24,when:()=>v('H01','cost_basis')==='shift'})],
{when:()=>internal()&&ground(),hint:'Use one combined cost including the operator, fuel, maintenance and rental or ownership costs. An estimate is sufficient. Costs already included in your all-in cleaning cost will not be added again.'}),
Q('H02','Who would operate the robotic washing system?',[
R('operator','Preferred arrangement',[['site','Our personnel, trained by MCS'],['mcs','An MCS-provided operator'],['unknown','Undecided']]),
N('labour_rate','Employer cost per operator-hour, if known','per worker-hour',{when:()=>!internal()&&v('H02','operator')==='site',hint:'Include wages, employer contributions, benefits and shift premiums.'})],
{when:()=>!!model(),hint:'This helps determine which party bears future supervision costs. Staff time released for other duties is valued separately from actual payroll savings.'}),
Q('L04','How much fresh water is used for washing?',[
N('regular','Regular contamination','litres / wash'),
N('heavy','Heavy contamination','litres / wash',{when:()=>Number(v('O10','heavy'))>0}),
R('basis','How is consumption known?',[['measured','Measured'],['estimated','Estimated'],['unknown','Not sure']])],
{when:internal,hint:'Approximate litres supplied for each wash; use “Not known” if unavailable. Reduced water and energy needs are assessed in the business case.'}),
Q('F02',()=>v('F01','known')==='yes'?'What water rate or excluded costs should we use?':'What other costs make up the current wash?',()=>itemFields(),
{when:()=>internal()&&['yes','no'].includes(v('F01','known')),hint:'Labour rates are already in the shift table. Water consumption is above. Always include the water tariff if known, so we can assess future consumption. For the other items, enter only costs excluded from your all-in wash cost; unknown amounts can be discussed later.'}),
Q('F05','Do you have separate yearly wastewater handling or treatment costs?',[
R('has_cost','Select one',[['yes','Yes'],['no','No / already included in other costs'],['unknown','Not sure']]),
N('annual_cost','Estimated annual cost attributable to container washing','per year',{when:()=>v('F05','has_cost')==='yes',hint:'Include sewer charges, oil separator servicing, treatment or disposal where relevant. Estimate the share attributable to washing, not the whole terminal.'})],
{when:()=>internal()&&(v('F01','known')!=='yes'||!incl('wastewater')),hint:'One approximate yearly total is enough. Leave it blank if unknown. Do not repeat costs included in the fresh-water tariff or all-in washing cost. Detailed drainage and site requirements will be checked separately.'}),
Q('F03','What do you currently pay the contractor per container wash?',[
N('average_cost','Average contractor charge','per wash'),
R('scope','Does that charge include handling and transport?',[['yes','Yes'],['no','No'],['partly','Partly'],['unknown','Not sure']]),
N('extra','Additional cost retained by your terminal, if any','per wash')],
{when:external,hint:'Use the supplier invoice or contract amount as the baseline. Do not reconstruct the contractor’s labour, water, chemicals or wastewater costs.'}),
]},
{title:'Demand & priorities',desc:'Capacity constraints, additional options and project priorities.',questions:[
Q('V01','Do current constraints prevent you from meeting all wash demand?',[
R('demand','Select one',[['yes','Yes'],['no','No — we meet the current demand'],['unknown','Not sure / not measured']])],{when:current,hint:'Consider weather, staff availability, space, handling and other operational limits. This concerns current versus potential wash volume.'}),
Q('V02',()=>model()==='none'?'What currently prevents you from providing a wash service?':'How much more wash demand could you serve if those constraints were resolved?',[
N('additional','Additional containers per month, above the current volume','containers',{when:current,hint:'A rough estimate is fine. Exclude containers already in your monthly total, including those washed later after a delay.'}),
M('constraints','What currently limits the operation?',[['weather','Weather / freezing'],['staff','Staff shortages / availability'],['space','Insufficient space / wash positions'],['handling','Container handling / access'],['equipment','Wash equipment / capacity'],['wastewater','Wastewater handling'],['hours','Operating hours'],['provider','Contractor availability'],['other','Other'],['unknown','Not sure']]),
T('reason','Describe the constraints and what happens to the affected containers',{placeholder:'For example: requests are turned away, containers go elsewhere, or washes wait until staff or space become available.'})],{when:()=>model()==='none'||(current()&&['yes','unknown'].includes(v('V01','demand'))),hint:()=>model()==='none'?'The potential monthly volume is already captured in the volume question. Explain what currently prevents that operation.':'Potential volume is your current monthly volume plus the additional demand entered here. This is an opportunity estimate; the business case must consider whether each constraint can actually be resolved.'}),
Q('V03','Are there recurring wash shutdowns or interruptions?',[
R('interruptions','Select one',yesno),N('days','Operating days affected per year','days',{max:366,when:()=>v('V03','interruptions')==='yes'}),
T('causes','Causes and what happens to those containers',{when:()=>v('V03','interruptions')==='yes',placeholder:'Are washes lost, sent elsewhere or completed later? Explain rather than adding them to demand again.'})],{when:current}),
Q('V04','Do customers reject containers or complain because they are not washed well enough?',[
R('claims','Select one',yesno),N('count','Rejections / complaints in a typical month','cases',{when:()=>v('V04','claims')==='yes'}),T('nature','What are the complaints, and how are they resolved?',{when:()=>v('V04','claims')==='yes'}),
N('cost','Average credit / compensation / claim handling cost','per claim',{financial:true,when:()=>v('V04','claims')==='yes'}),R('included','Is this already included in the wash cost you provided?',yesno,{financial:true,when:()=>v('V04','claims')==='yes'})],{when:current,hint:'Count each affected container once, even if a complaint also leads to a rejection. Any future reduction needs evidence before it is counted as a saving.'}),
Q('V05','Which additional options would be relevant to your site?',[
M('services','Select relevant options',[['drying','Active drying'],['inspection','Digital container interior inspection'],['proof','Cleaning documentation / proof of completion'],['recycling','Closed-loop water recycling'],['none','None currently'],['unknown','Not sure']]),
T('recycling_requirements','Water recycling: current arrangements or requirements',{when:()=>has('V05','services','recycling'),placeholder:'Optional: existing recycling equipment, water supply or discharge constraints, and any specific requirements.'})],{when:()=>!!model(),hint:'Select customer services or operational improvements to assess. Interior inspection is separate from mechanical reefer PTI. Water recycling is assessed for site suitability and operating cost, not as a customer service charge.'}),
Q('V06','How much demand is there for active drying?',[
N('monthly','Of the monthly wash volume above, containers that could also be dried','containers / month'),R('today','How is drying handled today?',[['air','Natural / air drying'],['active','Active drying'],['none','No drying'],['other','Other / varies']]),N('time','Typical current drying time','minutes'),N('price','Potential additional charge for active drying','per container',{financial:true}),T('evidence','What customer need or commitment supports this estimate?')],{when:()=>has('V05','services','drying')}),
Q('V07','How much demand is there for digital interior inspection?',[
N('monthly','Of the monthly wash volume above, containers that could also be inspected','containers / month'),N('price','Potential additional charge for digital interior inspection','per container',{financial:true}),T('evidence','Current inspection process and customer demand')],{when:()=>has('V05','services','inspection')}),
Q('V08','How much demand is there for wash documentation?',[
N('monthly','Of the monthly wash volume above, containers needing documentation','containers / month'),R('billing','Would documentation be included or sold separately?',[['included','Included in the wash service'],['separate','Charged separately'],['unknown','Not sure']]),N('price','Potential additional charge for documentation','per container',{financial:true,when:()=>v('V08','billing')==='separate'}),T('evidence','What records do customers need?')],{when:()=>has('V05','services','proof')}),
Q('V09','What are your main priorities for this project?',[
M('priorities','Choose up to three priorities',[['cost','Lower wash cost'],['safety','Less human exposure inside containers'],['capacity','More wash capacity'],['quality','More consistent wash quality'],['residues','Ability to wash difficult residues'],['water','Less water / wastewater'],['energy','Lower energy use'],['staff','Less physically demanding work'],['uptime','More reliable availability']],{limit:3}),
T('success','Any specific targets, concerns or requirements?')],{when:()=>!!model(),hint:'Operational, safety and environmental benefits are reported alongside financial outcomes. They are not automatically converted into cash savings.'})]}
];
if (answers.O06?.chemical_frequency === 'all' && answers.O06.chemical_share == null) answers.O06.chemical_share = '100';
if (answers.L03?.delays && answers.L03.bottleneck_details == null) answers.L03.bottleneck_details = answers.L03.delays;
const reviewStep=sections.length;
function title(q){return typeof q.title==='function'?q.title():q.title;}
function fields(q){return (typeof q.fields==='function'?q.fields():q.fields).filter(f=>!f.when||f.when());}
function visible(q){return !q.when||q.when();}
function qs(){return sections.flatMap(s=>s.questions.filter(visible));}
function rows(){return Array.isArray(a('L01').rows)&&a('L01').rows.length?a('L01').rows:[{people:'',hours:'',washes:'',allocation:'100'}];}
const shiftPeriods=[['day','Daytime'],['evening','Evening'],['night','Night']];
const shiftFields=()=>internal()?[['people','Cleaning personnel','people'],['hours','Paid shift length','hours'],['rate','Employer cost per person-hour',currency()+' / hr'],['washes','Containers cleaned by this shift','containers'],['allocation','Paid staff time allocated to cleaning','%']]:[['hours','Available operating hours','hours']];
const filledNumber=x=>x!==''&&x!==null&&x!==undefined&&Number.isFinite(Number(x));
function answered(q){if(unknown[q.id])return true;if(q.kind==='shifts')return rows().some(r=>r.hours!==''||internal()&&(r.people!==''||r.washes!==''));return fields(q).some(f=>{const z=v(q.id,f.key);return Array.isArray(z)?z.length:typeof z==='string'?z.trim()!=='':z!=='';});}
function number(id,k){const x=v(id,k);return x!==''&&Number.isFinite(Number(x))?Number(x):null;}
function activeAnswers(){const out={};for(const q of qs()){if(unknown[q.id]){out[q.id]={status:'unknown'};continue;}if(q.kind==='shifts'){const keys=['period',...shiftFields().map(f=>f[0])];out[q.id]={rows:rows().map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>keys.includes(k))))};continue;}out[q.id]=Object.fromEntries(fields(q).filter(f=>v(q.id,f.key)!=='').map(f=>[f.key,v(q.id,f.key)]));}return out;}
function derived(){
 const month=number('O04','monthly'),days=number('O04','days');
 const out={monthly_washes:month,annual_washes:month===null?null:month*12,average_washes_per_operating_day:month!==null&&days>0?month/days:null,volume_basis:model()==='none'?'potential demand':'existing washes'};
 const additional=current()?(v('V01','demand')==='no'?0:['yes','unknown'].includes(v('V01','demand'))?number('V02','additional'):null):null;
 out.current_monthly_washes=model()==='none'?0:month;
 out.additional_monthly_demand=additional;
 out.potential_monthly_washes=model()==='none'?month:(month!==null&&additional!==null?month+additional:null);
 out.contractor_baseline_cost_per_wash=external()?number('F03','average_cost'):null;
 out.chemical_use_percent=internal()?(v('O06','chemicals')==='no'?0:v('O06','chemicals')==='yes'?number('O06','chemical_share'):null):null;
 out.cleaning_cycle_minutes_regular=internal()?number('L02','cycle_regular'):null;
 out.cleaning_cycle_minutes_heavy=internal()&&number('O10','heavy')>0?number('L02','cycle_heavy'):null;
 if(internal()&&ground()){
  const hours=number('H01','handling_hours'),shiftHours=number('H01','shift_hours'),shiftCost=number('H01','shift_cost');
  out.reach_stacker_allocated_hours_per_month=hours!==null&&days!==null?hours*days:null;
  out.reach_stacker_combined_hourly_cost=v('H01','cost_basis')==='hour'?number('H01','hourly_cost'):
   v('H01','cost_basis')==='shift'&&shiftHours>0&&shiftHours<=24&&shiftCost!==null?shiftCost/shiftHours:null;
 }
 out.wastewater_baseline_cost_per_wash=visible(sections.flatMap(s=>s.questions).find(q=>q.id==='F05'))&&internal()&&v('F05','has_cost')==='yes'&&number('F05','annual_cost')!==null&&out.annual_washes>0?number('F05','annual_cost')/out.annual_washes:null;
 if(internal()&&!unknown.L01){
  const rs=rows();
  const hoursOk=rs.every(r=>['hours','people','washes','allocation'].every(k=>filledNumber(r[k])&&+r[k]>=0));
  if(hoursOk){
   const hours=rs.reduce((n,r)=>n+Number(r.hours),0),washes=rs.reduce((n,r)=>n+Number(r.washes),0);
   const paid=rs.reduce((n,r)=>n+Number(r.hours)*Number(r.people)*Number(r.allocation)/100,0);
   out.shift_washes_per_day=washes;out.allocated_labour_hours_per_day=paid;
   out.labour_hours_per_wash=washes>0?paid/washes:null;
   out.throughput_interval_minutes=washes>0?hours*60/washes:null;
   out.shift_implied_monthly_washes=days!==null?washes*days:null;
   if(rs.every(r=>filledNumber(r.rate)&&+r.rate>=0)){
    const daily=rs.reduce((n,r)=>n+Number(r.hours)*Number(r.people)*Number(r.allocation)/100*Number(r.rate),0);
    out.allocated_labour_cost_per_day=daily;
    out.labour_cost_per_wash=washes>0?daily/washes:null;
   }
  }
 }
 return out;
}
function warnings(){const w=[];for(const q of qs()){if(unknown[q.id])continue;for(const f of fields(q)){const n=number(q.id,f.key);if(f.type==='number'&&n!==null&&(n<(f.min??0)||(f.max!==undefined&&n>f.max)))w.push(`${q.id}: ${f.label} is outside the allowed range.`);}if(q.split){const fs=fields(q).filter(f=>f.type==='number'),filled=fs.filter(f=>v(q.id,f.key)!=='');if(filled.length){const sum=filled.reduce((n,f)=>n+Number(v(q.id,f.key)),0);if(Math.abs(sum-100)>.01)w.push(`${q.id}: container shares total ${sum}%; use 100%.`);}}}
if(!unknown.L01&&model()){rows().forEach((r,i)=>{if(r.hours!==''&&(+r.hours<=0||+r.hours>24))w.push(`L01: shift ${i+1} must be longer than 0 and no longer than 24 hours.`);if(internal()&&r.allocation!==''&&(+r.allocation<0||+r.allocation>100))w.push(`L01: shift ${i+1} allocation must be 0–100%.`);if(internal()&&['people','washes','rate'].some(k=>r[k]!==''&&+r[k]<0))w.push(`L01: shift ${i+1} cannot contain negative values.`);});const hours=rows().reduce((n,r)=>n+(+r.hours||0),0);if(hours>24)w.push('L01: sequential daily shifts total more than 24 hours; check the schedule.');}
if(visible(sections.flatMap(s=>s.questions).find(q=>q.id==='F05'))&&internal()&&v('F05','has_cost')==='yes'&&v('F02','water_includes_sewer')==='yes')w.push('F05: check that annual wastewater costs do not repeat sewer charges included in the water rate.');
const d=derived();
if(d.monthly_washes>0&&d.shift_implied_monthly_washes!==null&&d.shift_implied_monthly_washes!==undefined&&Math.abs(d.shift_implied_monthly_washes-d.monthly_washes)/d.monthly_washes>.2)w.push('Monthly volume and typical shift output differ by more than 20%. Explain seasonality or check these estimates.');
for(const id of ['V06','V07','V08'])if(qs().some(q=>q.id===id)&&number(id,'monthly')!==null&&d.monthly_washes!==null&&number(id,'monthly')>d.monthly_washes)w.push(`${id}: additional-service demand exceeds the monthly wash volume it refers to.`);
if(d.monthly_washes>0&&number('O04','days')===0)w.push('O04: a positive wash volume needs at least one operating day.');
for(const note of revisionNotes())w.push(`${note.id}: ${note.message}`);
return w;}

function revisionNotes() {
 const notes=[];
 const add=(id,message)=>{if(qs().some(q=>q.id===id)&&!unknown[id])notes.push({id,message});};
 if(number('O08','other')>0&&v('O08','oog')==='')add('O08',`Your previous draft included ${format(number('O08','other'))}% under Other. Confirm the OOG percentage using the categories above; Other has not been relabelled as OOG.`);
 if(internal()&&((v('L02','regular')!==''&&v('L02','cycle_regular')==='')||(number('O10','heavy')>0&&v('L02','heavy')!==''&&v('L02','cycle_heavy')==='')))add('L02','Please enter cleaning cycle times using the definition above. The earlier active-cleaning times have not been reused.');
 if(['machine_hours','operator_hours','machine_rate','operator_rate'].some(key=>v('H01',key)!=='')&&v('H01','cost_basis')===''&&v('H01','handling_hours')==='')add('H01','Please update the handling time and combined machine-and-operator cost. The earlier separate cost entries have not been reused.');
 return notes;
}

function errors() {
 const result = [];
 const push = (id, key, message) => result.push({ id, key, message });
 for (const q of qs()) {
  if (unknown[q.id] && !['G02','O01'].includes(q.id)) continue;
  for (const f of fields(q)) {
   const value = v(q.id, f.key);
   if (f.required && !String(value).trim()) push(q.id, f.key, `Please add ${f.label.toLowerCase()}.`);
   if (f.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) push(q.id, f.key, 'Please enter a valid work email address.');
   if (f.type === 'number' && value !== '' && (!Number.isFinite(Number(value)) || +value < (f.min ?? 0) || (f.max !== undefined && +value > f.max))) push(q.id, f.key, `${f.label}: enter a number from ${f.min ?? 0}${f.max !== undefined ? ' to '+f.max : ' or higher'}.`);
  }
  if (q.split) {
   const values = fields(q).filter(f=>f.type==='number').map(f=>v(q.id,f.key));
   if (values.some(x=>x!=='') && Math.abs(values.reduce((sum,x)=>sum+(Number(x)||0),0)-100)>.01) push(q.id,'dry20','Container shares should total 100%. Estimates are fine, or mark this question as not known.');
  }
 }
 if (!model()) push('O01','model','Please select your current wash arrangement.');
 if (v('G02','currency')==='Other' && !String(v('G02','other_currency')).trim()) push('G02','other_currency','Please specify your currency code.');
 if (model() && !unknown.L01) rows().forEach((row, i) => {
  for (const [key, label] of shiftFields()) {
   if (row[key] === '' || row[key] == null) continue;
   const n = Number(row[key]);
   if (!Number.isFinite(n) || n<0 || (key==='hours'&&(n<=0||n>24)) || (key==='allocation'&&n>100)) push('L01',`shift-${i}-${key}`,`Shift ${i+1}: check ${label.toLowerCase()}. Hours must be above 0 and at most 24; allocation must be 0–100%.`);
  }
 });
 return result;
}
function setAnswer(id, key, value) {
 answers[id] ||= {};
 answers[id][key] = value;
}
function setUnknown(id, value) { if (!['G02','O01'].includes(id)) unknown[id]=value; }
function setComment(id, value) { comments[id]=value; }
function reset() { answers={}; comments={}; unknown={}; }
return { sections, reviewStep, title, fields, visible, qs, rows, shiftPeriods, shiftFields,
 v, a, has, model, internal, external, current, ground, currency, number, format, answered,
 activeAnswers, derived, warnings, errors, revisionNotes, setAnswer, setUnknown, setComment, reset,
 get state() { return {answers,comments,unknown,schemaVersion:'3.1'}; }
};
}
