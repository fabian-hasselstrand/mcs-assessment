import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssessmentModel } from '../assessment-model.js';
const contact={company:'Test Port',site:'Test Terminal',country:'Sweden',currency:'SEK',contact:'Test Director',email:'director@example.com'};
const make=(answers={},unknown={})=>createAssessmentModel({answers:{G02:contact,...answers},unknown});
const ids=m=>m.qs().map(q=>q.id);
const fields=(m,id)=>m.fields(m.qs().find(q=>q.id===id)).map(f=>f.key);

test('initial questionnaire asks only site details and wash arrangement',()=>{
 const m=make();assert.deepEqual(ids(m),['G02','O01']);assert.ok(m.errors().some(e=>e.id==='O01'));
});
test('internal washing includes operation, staffing and itemised costs',()=>{
 const m=make({O01:{model:'internal'},O02:{position:'ground'},F01:{known:'no'}});
 for(const id of ['O03','O06','O07','L01','L02','H01','L04','F02','F05','V01'])assert.ok(ids(m).includes(id),id);
 assert.ok(!ids(m).includes('F03'));assert.deepEqual(m.errors(),[]);
});
for(const model of ['external_on','external_off'])test(`${model} uses invoices and proposed hours, excludes contractor internals`,()=>{
 const m=make({O01:{model},O02:{position:'chassis'},F01:{known:'no'},O06:{chemicals:'yes'},L01:{rows:[{hours:'8',people:'4',rate:'300'}]}});
 for(const id of ['F03','L01','L03','H02'])assert.ok(ids(m).includes(id),id);
 for(const id of ['F01','F02','F05','L02','L04','O06','O07','H01','O03'])assert.ok(!ids(m).includes(id),id);
 assert.deepEqual(m.activeAnswers().L01.rows,[{hours:'8'}]);assert.equal(m.derived().labour_cost_per_wash,undefined);
});
test('no existing wash distinguishes potential demand from current business',()=>{
 const m=make({O01:{model:'none'},O04:{monthly:'600',days:'20'}});
 assert.equal(m.derived().current_monthly_washes,0);assert.equal(m.derived().potential_monthly_washes,600);
 for(const id of ['O02','O03','H01','V01','V03','V04','F01','F03','F04','L03'])assert.ok(!ids(m).includes(id),id);
 assert.ok(ids(m).includes('V02'));assert.ok(!fields(m,'V02').includes('additional'));
});
test('ground layout and handling disappear after switching to chassis',()=>{
 const m=make({O01:{model:'internal'},O02:{position:'ground'},H01:{handling_hours:'8'}});
 assert.ok(ids(m).includes('H01'));m.setAnswer('O02','position','chassis');
 assert.ok(!ids(m).includes('H01'));assert.ok(!ids(m).includes('O03'));assert.equal(m.activeAnswers().H01,undefined);
});
test('hidden costs never leak from an all-in baseline into wastewater calculations',()=>{
 const m=make({O01:{model:'internal'},O04:{monthly:'100',days:'20'},F01:{known:'yes',included:['wastewater','energy','equipment']},F05:{has_cost:'yes',annual_cost:'12000'},F02:{water_includes_sewer:'yes'}});
 assert.ok(!ids(m).includes('F05'));assert.equal(m.derived().wastewater_baseline_cost_per_wash,null);
 assert.ok(!fields(m,'F02').includes('energy'));assert.ok(!fields(m,'F02').includes('equipment'));
 assert.ok(fields(m,'F02').includes('water'));assert.ok(!m.warnings().some(w=>w.startsWith('F05')));
});
test('labour uses paid hours × people × allocation × rate without double counting',()=>{
 const m=make({O01:{model:'internal'},O04:{monthly:'400',days:'20'},L01:{rows:[{hours:'8',people:'2',allocation:'50',rate:'250',washes:'20'}]},L02:{cycle_regular:'20'},O10:{heavy:'0'}});
 const d=m.derived();assert.equal(d.allocated_labour_hours_per_day,8);assert.equal(d.labour_hours_per_wash,.4);assert.equal(d.labour_cost_per_wash,100);assert.equal(d.shift_implied_monthly_washes,400);assert.equal(d.throughput_interval_minutes,24);
});
test('unknowns remain missing while genuine zero costs are retained',()=>{
 const m=make({O01:{model:'internal'},O04:{monthly:'100'},F05:{has_cost:'yes',annual_cost:'0'},L01:{rows:[{hours:'8',people:'1',allocation:'100',rate:'',washes:'20'}]}});
 assert.equal(m.derived().wastewater_baseline_cost_per_wash,0);assert.equal(m.derived().labour_cost_per_wash,undefined);
 assert.equal(m.derived().average_washes_per_operating_day,null);
 m.setUnknown('O04',true);assert.equal(m.derived().monthly_washes,null);assert.deepEqual(m.activeAnswers().O04,{status:'unknown'});
});
test('changing parent answers hides chemical and heavy-residue detail in exports',()=>{
 const m=make({O01:{model:'internal'},O06:{chemicals:'yes',chemical_names:'Detergent'},O10:{heavy:'30'},L02:{cycle_heavy:'12'}});
 assert.ok(fields(m,'L02').includes('cycle_heavy'));m.setAnswer('O10','heavy','0');m.setAnswer('O06','chemicals','no');
 assert.ok(!fields(m,'L02').includes('cycle_heavy'));assert.equal(m.activeAnswers().O06.chemical_names,undefined);assert.equal(m.activeAnswers().L02.cycle_heavy,undefined);
});
test('service estimates move into V05 and retired follow-ups stay out of exports',()=>{
 const m=make({O01:{model:'internal'},V05:{services:['drying','inspection','proof']},V06:{monthly:'30',price:'10'},V07:{monthly:'20'},V08:{monthly:'15',billing:'separate',price:'25'}});
 for(const id of ['V06','V07','V08']){assert.ok(!ids(m).includes(id));assert.equal(m.activeAnswers()[id],undefined);}
 assert.equal(m.activeAnswers().V05.drying_monthly,'30');assert.equal(m.activeAnswers().V05.inspection_monthly,'20');assert.equal(m.activeAnswers().V05.proof_monthly,'15');
 m.setAnswer('V05','services',['none']);assert.equal(m.activeAnswers().V05.drying_monthly,undefined);
});
test('validation requires usable contact details but permits unknown financial inputs',()=>{
 const m=make({O01:{model:'internal'}});assert.equal(m.errors().length,0);
 m.setAnswer('G02','email','invalid');m.setAnswer('G02','company',' ');m.setAnswer('G02','currency','Other');
 for(const key of ['email','company','other_currency'])assert.ok(m.errors().some(e=>e.key===key),key);
});
test('out-of-range percentages, days and shift values are rejected',()=>{
 const m=make({O01:{model:'internal'},O04:{days:'32'},O10:{heavy:'101'},O08:{dry20:'70',dry40:'40'},L01:{rows:[{hours:'25',allocation:'101',people:'-1'}]}});
 for(const id of ['O04','O08','O10','L01'])assert.ok(m.errors().some(e=>e.id===id),id);
 m.setUnknown('O08',true);assert.ok(!m.errors().some(e=>e.id==='O08'));
});
test('100% container splits accepted; incomplete splits are surfaced',()=>{
 const m=make({O01:{model:'internal'},O08:{dry20:'40',dry40:'60'}});assert.ok(!m.errors().some(e=>e.id==='O08'));
 m.setAnswer('O08','dry40','50');assert.ok(m.errors().some(e=>e.id==='O08'));
});
test('capacity, service demand and annual wastewater checks remain visible',()=>{
 const m=make({O01:{model:'internal'},O04:{monthly:'100',days:'20'},O10:{heavy:'0'},L01:{rows:[{hours:'8',people:'1',allocation:'50',rate:'200',washes:'30'}]},L02:{cycle_regular:'20'},F05:{has_cost:'yes',annual_cost:'12000'},F02:{water_includes_sewer:'yes'},V05:{services:['drying']},V06:{monthly:'200'}});
 const w=m.warnings().join('\n');assert.doesNotMatch(w,/worker-hours/);assert.match(w,/differ by more than 20%/);assert.match(w,/exceeds the monthly/);assert.match(w,/repeat sewer charges/);
 assert.equal(m.derived().wastewater_baseline_cost_per_wash,10);
});
test('marking a parent question unknown suppresses its dependent questions',()=>{
 const m=make({O01:{model:'internal'},O02:{position:'ground'},V05:{services:['drying']}});
 m.setUnknown('O02',true);m.setUnknown('V05',true);assert.ok(!ids(m).includes('H01'));assert.ok(!ids(m).includes('V06'));
 m.setUnknown('G02',true);assert.equal(m.state.unknown.G02,undefined);
});

test('no-current-cleaning route ignores old layout and handling data',()=>{
 const m=make({O01:{model:'none'},O02:{position:'ground',future:'yes'},H01:{handling_hours:'8',cost_basis:'hour',hourly_cost:'1000'}});
 for(const id of ['O02','O03','H01'])assert.equal(m.activeAnswers()[id],undefined);
 assert.equal(m.derived().reach_stacker_combined_hourly_cost,undefined);
 m.setAnswer('O01','model','internal');assert.ok(ids(m).includes('O02'));assert.equal(m.activeAnswers().O02.future,undefined);
});
test('chemical percentage distinguishes no chemicals, unknown and a measured share',()=>{
 const m=make({O01:{model:'internal'},O06:{chemicals:'yes',chemical_share:'35'}});
 assert.equal(m.derived().chemical_use_percent,35);assert.equal(m.activeAnswers().O06.chemical_share,'35');
 m.setAnswer('O06','chemical_share','101');assert.ok(m.errors().some(e=>e.key==='chemical_share'));
 m.setAnswer('O06','chemicals','no');assert.equal(m.derived().chemical_use_percent,0);assert.equal(m.activeAnswers().O06.chemical_share,undefined);
 m.setAnswer('O06','chemicals','unsure');assert.equal(m.derived().chemical_use_percent,null);
 m.setAnswer('O06','chemicals','yes');m.setUnknown('O06',true);assert.equal(m.derived().chemical_use_percent,null);
 m.setUnknown('O06',false);m.setAnswer('O01','model','external_on');assert.equal(m.derived().chemical_use_percent,null);
});
test('only the unambiguous previous all-chemicals answer becomes 100%',()=>{
 assert.equal(make({O06:{chemicals:'yes',chemical_frequency:'all'}}).v('O06','chemical_share'),'100');
 assert.equal(make({O06:{chemicals:'yes',chemical_frequency:'some'}}).v('O06','chemical_share'),'');
 assert.equal(make({O06:{chemicals:'yes',chemical_frequency:'all',chemical_share:'20'}}).v('O06','chemical_share'),'20');
});
test('OOG counts in container mix without relabelling an earlier Other answer',()=>{
 const m=make({O01:{model:'internal'},O08:{dry20:'50',dry40:'40',other:'10',other_type:'Tank'}});
 assert.equal(m.activeAnswers().O08.other,undefined);assert.equal(m.v('O08','oog'),'');
 assert.ok(m.revisionNotes().some(n=>n.id==='O08'));assert.ok(m.errors().some(e=>e.id==='O08'));
 m.setAnswer('O08','oog','10');assert.ok(!m.errors().some(e=>e.id==='O08'));assert.ok(!m.revisionNotes().some(n=>n.id==='O08'));
 assert.ok(fields(m,'O08').includes('oog_details'));m.setAnswer('O08','oog','0');assert.ok(!fields(m,'O08').includes('oog_details'));
});
test('cycle time is not treated as active labour or old container turnaround',()=>{
 const m=make({O01:{model:'internal'},O10:{heavy:'20'},L01:{rows:[{people:'1',hours:'8',allocation:'100',rate:'200',washes:'30'}]},L02:{regular:'10',heavy:'20',people:'2'},L03:{minutes:'90',delays:'Containers wait for the reach-stacker.'}});
 assert.equal(m.derived().cleaning_cycle_minutes_regular,null);assert.ok(m.revisionNotes().some(n=>n.id==='L02'));
 m.setAnswer('L02','cycle_regular','60');m.setAnswer('L02','cycle_heavy','120');
 assert.equal(m.derived().cleaning_cycle_minutes_regular,60);assert.equal(m.derived().cleaning_cycle_minutes_heavy,120);
 assert.equal(m.derived().allocated_labour_hours_per_day,8);assert.ok(!m.warnings().some(w=>w.includes('worker-hours')));
 assert.deepEqual(m.activeAnswers().L02,{cycle_regular:'60',cycle_heavy:'120'});
 assert.deepEqual(m.activeAnswers().L03,{bottleneck_details:'Containers wait for the reach-stacker.'});
 assert.ok(!Object.hasOwn(m.derived(),'measured_or_estimated_turnaround_minutes'));
});
test('combined handling costs accept hourly and shift rates without double counting',()=>{
 const m=make({O01:{model:'internal'},O02:{position:'ground'},O04:{monthly:'500',days:'20'},F01:{known:'yes',cost:'100',included:['handling']},H01:{handling_hours:'4',cost_basis:'hour',hourly_cost:'750',machine_rate:'600',operator_rate:'150'}});
 assert.equal(m.derived().reach_stacker_combined_hourly_cost,750);assert.equal(m.derived().reach_stacker_allocated_hours_per_month,80);
 m.setAnswer('H01','cost_basis','shift');m.setAnswer('H01','shift_cost','6000');m.setAnswer('H01','shift_hours','8');
 assert.equal(m.derived().reach_stacker_combined_hourly_cost,750);assert.equal(m.activeAnswers().H01.hourly_cost,undefined);assert.equal(m.activeAnswers().H01.machine_rate,undefined);
 assert.equal(m.activeAnswers().F01.cost,'100');
 m.setAnswer('H01','shift_hours','0');assert.equal(m.derived().reach_stacker_combined_hourly_cost,null);assert.ok(m.errors().some(e=>e.key==='shift_hours'));
 m.setAnswer('H01','cost_basis','unknown');assert.equal(m.derived().reach_stacker_combined_hourly_cost,null);assert.ok(!m.errors().some(e=>e.id==='H01'));
 m.setAnswer('H01','cost_basis','hour');m.setAnswer('H01','hourly_cost','0');assert.equal(m.derived().reach_stacker_combined_hourly_cost,0);
 m.setUnknown('H01',true);assert.equal(m.derived().reach_stacker_combined_hourly_cost,null);
});
test('retired handling costs and selling price are absent from the assessment',()=>{
 const m=make({O01:{model:'internal'},O02:{position:'ground'},H01:{machine_hours:'5',machine_rate:'100',operator_rate:'50'},F04:{average_price:'500'}});
 assert.equal(m.derived().reach_stacker_combined_hourly_cost,null);assert.ok(m.revisionNotes().some(n=>n.id==='H01'));
 for(const model of ['internal','external_on','external_off','none']){m.setAnswer('O01','model',model);assert.ok(!ids(m).includes('F04'));assert.equal(m.activeAnswers().F04,undefined);}
});
test('water recycling is an operational option with conditional requirements',()=>{
 const m=make({O01:{model:'internal'},V05:{services:['recycling'],recycling_requirements:'Reduce discharge'}});
 assert.ok(fields(m,'V05').includes('recycling_requirements'));assert.equal(m.activeAnswers().V05.recycling_requirements,'Reduce discharge');
 for(const id of ['V06','V07','V08'])assert.ok(!ids(m).includes(id));
 m.setAnswer('V05','services',['none']);assert.equal(m.activeAnswers().V05.recycling_requirements,undefined);
});

test('V03 captures annual affected days and containers and drops inactive detail',()=>{
 const m=make({O01:{model:'internal'},V03:{interruptions:'yes',days:'12',containers_year:'250',causes:'Freezing weather'}});
 assert.deepEqual(m.activeAnswers().V03,{interruptions:'yes',days:'12',containers_year:'250',causes:'Freezing weather'});
 m.setAnswer('V03','days','367');assert.ok(m.errors().some(e=>e.id==='V03'&&e.key==='days'));
 m.setAnswer('V03','days','0');assert.ok(m.warnings().some(w=>w.startsWith('V03:')));
 m.setAnswer('V03','interruptions','no');assert.deepEqual(m.activeAnswers().V03,{interruptions:'no'});
 assert.ok(!m.errors().some(e=>e.id==='V03'));assert.ok(!m.warnings().some(w=>w.startsWith('V03:')));
});
test('delay question is free text and ignores retired numeric costs',()=>{
 const m=make({O01:{model:'internal'},V01:{demand:'no'},V03:{interruptions:'no'},V03A:{details:'Storage costs about 500 per month',cost_monthly:'999',waiting:'yes'}});
 assert.deepEqual(fields(m,'V03A'),['details']);assert.deepEqual(m.activeAnswers().V03A,{details:'Storage costs about 500 per month'});
 assert.equal(m.derived().cleaning_constraint_costs,undefined);
 m.setAnswer('O01','model','none');assert.equal(m.activeAnswers().V03A,undefined);
});
test('claims percentage validates without converting old monthly counts',()=>{
 const m=make({O01:{model:'internal'},V04:{count:'10',cost:'50'}});
 assert.deepEqual(fields(m,'V04'),['percentage']);assert.equal(m.activeAnswers().V04.percentage,undefined);assert.ok(m.revisionNotes().some(n=>n.id==='V04'));
 m.setAnswer('V04','percentage','101');assert.ok(m.errors().some(e=>e.id==='V04'));
 m.setAnswer('V04','percentage','2.5');assert.ok(!m.errors().some(e=>e.id==='V04'));assert.deepEqual(m.activeAnswers().V04,{percentage:'2.5'});
});
