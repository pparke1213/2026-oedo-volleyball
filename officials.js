/* 외도초 바운스발리볼: 21인 학생 운영위원 사무실 전용 배정 */
(function(){
'use strict';
const ROLES=[['chief','주심'],['line1','선심 1'],['line2','선심 2'],['record','기록자']];
const KEY='oedo-volleyball-private-officials-v1';
const CLUB_SIZE=21;
const dayNames=['일','월','화','수','목','금','토'];
let api=null;
let data={members:[],assignments:{}};
function $(s){return document.querySelector(s);}
function h(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
function clubId(n){return 'C'+String(n).padStart(2,'0');}
function defaults(){return {members:Array.from({length:CLUB_SIZE},(_,i)=>({id:clubId(i+1),name:'',teamId:'?',unavailable:''})),assignments:{}};}
function normalize(raw){
 const dst=defaults();
 if(!raw||typeof raw!=='object')return dst;
 const src=Array.isArray(raw.members)?raw.members:[];
 for(let i=0;i<CLUB_SIZE;i++){
  const item=src.find(x=>x&&x.id===clubId(i+1))||src[i]||{};
  dst.members[i]={id:clubId(i+1),name:String(item.name||'').slice(0,32),teamId:String(item.teamId??'?').slice(0,12),unavailable:String(item.unavailable||'').slice(0,250)};
 }
 if(raw.assignments&&typeof raw.assignments==='object'){
  for(const [mid,rawRoles] of Object.entries(raw.assignments)){
   if(!/^[MW]-(?:P|Q|S|F)\d+$/.test(mid)||!rawRoles||typeof rawRoles!=='object')continue;
   const val={};for(const [role] of ROLES){
    if(/^C(?:0[1-9]|1[0-9]|2[01])$/.test(rawRoles[role]||''))val[role]=rawRoles[role];
   }
   if(Object.keys(val).length)dst.assignments[mid]=val;
  }
 }
 return dst;
}
function fromDisk(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||'null'));}catch(e){return defaults();}}
function disk(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){console.warn('운영위원 로컬 저장 실패',e);}}
function changed(message){
 disk();api.save();api.render();if(message)api.toast(message);
}
function snapshot(){return JSON.parse(JSON.stringify(data));}
function privateLoad(obj){if(obj&&Array.isArray(obj.members)){data=normalize(obj);disk();render();}}
function importBackup(obj){if(obj&&Array.isArray(obj.members)){data=normalize(obj);disk();}}
function memberById(id){return data.members.find(x=>x.id===id)||null;}
function membersPlayingTeam(member){
 const state=api.getState(),teams=[...state.teams.M,...state.teams.W],explicit=member.teamId;
 const norm=s=>String(s||'').replace(/\s+/g,'').trim();
 const found=member.name?teams.filter(t=>Array.isArray(t.members)&&t.members.some(n=>norm(n)&&norm(n)===norm(member.name))):[];
 if(explicit&&explicit!=='?'&&explicit!=='none'){
  const t=teams.find(t=>t.id===explicit);
  return t?{id:t.id,status:'linked',label:t.name}:{id:null,status:'unknown',label:'참가팀 다시 선택'};
 }
 if(found.length===1)return {id:found[0].id,status:'matched',label:'명단 일치 · '+found[0].name};
 if(found.length>1)return {id:null,status:'unknown',label:'동명이인: 참가팀 확인'};
 if(explicit==='none')return {id:null,status:'none',label:'경기 미참가'};
 return {id:null,status:'unknown',label:'출전 여부 미확인'};
}
function usedName(m){return m&&m.name.trim()?m.name.trim():'이름 미입력';}
function rosterName(id){return usedName(memberById(id));}
function allGames(){
 return Object.values(api.getState().matches).sort((a,b)=>a.date.localeCompare(b.date)||a.court-b.court||a.id.localeCompare(b.id));
}
function assignmentsFor(mid){return data.assignments[mid]||{};}
function dateLabel(date){
 const [year,month,day]=date.split('-').map(Number);
 const d=new Date(year,month-1,day,12);
 return (month||0)+'월 '+(day||0)+'일('+dayNames[d.getDay()]+')';
}
function possibleFromSource(source,seen){
 if(!source)return [];
 if(source.type==='team')return [source.id];
 if(source.type!=='winner'||!source.id||seen.has(source.id))return [];
 seen.add(source.id);
 const m=api.getState().matches[source.id];if(!m)return [];
 return m.winner?[m.winner]:[...possibleFromSource(m.a,new Set(seen)),...possibleFromSource(m.b,new Set(seen))];
}
function availableDates(member){
 return new Set(String(member.unavailable||'').split(/[,;\s]+/).map(s=>s.trim()).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)));
}
function dayOpponents(date){
 const matches=allGames().filter(m=>m.date===date),actual=new Set(),potential=new Set();
 for(const m of matches){
  const teamIds=api.participants(m);
  for(const id of teamIds)if(id)actual.add(id);
  for(const source of [m.a,m.b])for(const id of possibleFromSource(source,new Set()))potential.add(id);
 }
 return {actual,potential};
}
function statusFor(id,match,role,assignmentSet){
 const person=memberById(id);
 if(!person||!person.name.trim())return {block:true,reason:'이름 미입력'};
 const link=membersPlayingTeam(person);
 if(link.status==='unknown')return {block:true,reason:link.label};
 const absence=availableDates(person);
 if(absence.has(match.date))return {block:true,reason:'해당 날짜 배정 불가'};
 const others=allGames().filter(x=>x.date===match.date);
 for(const other of others){
  const roles=assignmentSet[other.id]||{};
  for(const [r] of ROLES)if(roles[r]===id && !(other.id===match.id&&r===role))return {block:true,reason:'같은 날 다른 역할 중복'};
 }
 const day=dayOpponents(match.date);
 if(link.id&&day.actual.has(link.id))return {block:true,reason:'당일 선수 출전'};
 if(link.id&&day.potential.has(link.id))return {block:false,soft:true,reason:'해당 날짜 출전 가능성 · 경기 전 재확인'};
 return {block:false,soft:false,reason:''};
}
function assignedStats(){
 const counts=Object.fromEntries(data.members.map(m=>[m.id,{total:0,roles:{chief:0,line1:0,line2:0,record:0}}]));
 const validMatches=new Set(allGames().map(m=>m.id));
 for(const [mid,r] of Object.entries(data.assignments))if(validMatches.has(mid))for(const [role] of ROLES)if(r[role]&&counts[r[role]]){counts[r[role]].total++;counts[r[role]].roles[role]++;}
 return counts;
}
function groupByDate(){
 const groups={};
 for(const m of allGames())(groups[m.date]??=[]).push(m);
 return Object.entries(groups).sort(([a],[b])=>a.localeCompare(b));
}
function render(){
 if(!api||!api.canEdit()||!$('#officialRosterBody'))return;
 const counts=assignedStats(),matches=allGames(),total=matches.length*4,filled=Object.values(data.assignments).reduce((n,assign)=>n+ROLES.filter(([r])=>!!assign[r]).length,0);
 const named=data.members.filter(m=>m.name.trim()).length;
 const linked=data.members.filter(m=>m.name.trim()&&membersPlayingTeam(m).status!=='unknown').length;
 let warningCount=0;
 const teamChoices=[...api.getState().teams.M,...api.getState().teams.W];
 $('#officialStats').innerHTML=[
  ['운영위원 명단',named+' / 21','21명 이름을 입력해 주세요'],
  ['출전 여부 확인',linked+' / '+named,'팀명 또는 선수 불참 연결'],
  ['전체 역할',filled+' / '+total,'경기당 4명 · 총 18경기'],
  ['진행일',String(groupByDate().length)+'일','동일 날짜 중복 배정 방지']
 ].map(x=>'<div class="official-tile"><small>'+x[0]+'</small><strong>'+x[1]+'</strong><span>'+x[2]+'</span></div>').join('');
 $('#officialRosterBody').innerHTML=data.members.map(m=>{
  const cnt=counts[m.id],link=membersPlayingTeam(m);
  const sel=(value,label)=>'<option value="'+h(value)+'"'+(m.teamId===value?' selected':'')+'>'+h(label)+'</option>';
  const options=sel('?','미확인(배정 제외)')+sel('none','경기 선수 아님')+teamChoices.map(t=>sel(t.id,(t.id.startsWith('M')?'남':'여')+' · '+t.name+(t.className?' ('+t.className+')':''))).join('');
  return '<article class="official-person"><div class="off-person-title"><b class="off-id">'+m.id+' · '+h(usedName(m))+'</b>'+
   '<span class="off-badge'+(link.status==='unknown'?' off-unresolved':'')+'">'+cnt.total+'회</span></div>'+
   '<div class="official-fields"><label>학생 이름<input data-off-name="'+m.id+'" value="'+h(m.name)+'" maxlength="32" placeholder="배구부 학생 이름" /></label>'+
   '<label>대회 참가 여부 / 소속팀<select data-off-team="'+m.id+'">'+options+'</select></label>'+
   '<label class="whole">배정 불가 날짜 (쉼표로 구분)<input data-off-absent="'+m.id+'" value="'+h(m.unavailable)+'" placeholder="예: 2026-11-20, 2026-11-24" /></label></div>'+
   '<div class="official-help" style="margin-top:7px">'+h(link.label)+' · '+cnt.total+'회 배정</div></article>';
 }).join('');
 const perDay=groupByDate().map(([date,games])=>{
  const dayConflicts=[];
  const cards=games.map(m=>{
   const assignments=assignmentsFor(m.id),participating=api.participants(m);
   const matchHeading=(m.g==='M'?'남학생부':'여학생부')+' · '+({'P':'예비전','Q':'8강','S':'준결승','F':'결승'}[m.round])+' '+m.index+'경기';
   const versus=participating.map(tid=>tid?api.teamName(tid):'승리팀 대기').join(' vs ');
   const fields=ROLES.map(([r,label])=>{
    const current=assignments[r]||'';
    const choices='<option value="">— 미배정 —</option>'+data.members.filter(person=>person.name.trim()||current===person.id).map(person=>'<option value="'+h(person.id)+'"'+(current===person.id?' selected':'')+'>'+h(person.name.trim()||person.id)+'</option>').join('');
    const check=current?statusFor(current,m,r,data.assignments):null;
    if(check&&check.reason)dayConflicts.push({match:matchHeading,role:label,student:rosterName(current),reason:check.reason,hard:check.block});
    return '<label class="'+(check?.block?'invalid':(check?.soft?'invalid':'valid'))+'">'+label+'<select data-off-role="'+h(m.id)+'" data-role="'+r+'">'+choices+'</select></label>';
   }).join('');
   return '<div class="official-game"><h4>'+h(matchHeading)+'</h4><div class="match-meta">코트 '+m.court+' · '+h(versus)+'</div><div class="official-role-grid">'+fields+'</div></div>';
  }).join('');
  warningCount+=dayConflicts.length;
  const labels=dayConflicts.map(x=>'<div class="official-warn">'+(x.hard?'⚠ 충돌':'△ 출전 가능성')+' · '+h(x.match)+' · '+h(x.role)+' '+h(x.student)+' : '+h(x.reason)+'</div>').join('');
  return '<section class="official-day panel"><div class="day-head"><b>'+dateLabel(date)+' · 오전 08:10~08:50</b><span class="pill">'+games.length+'경기 · '+(games.length*4)+'명 필요</span></div><div class="official-matches">'+cards+'</div>'+(labels?'<div style="padding:0 14px 13px">'+labels+'</div>':'')+'</section>';
 }).join('');
 $('#officialDays').innerHTML=perDay;
 const scores=Object.entries(counts).filter(([id])=>!!memberById(id)?.name.trim()).sort((a,b)=>b[1].total-a[1].total||a[0].localeCompare(b[0]));
 $('#officialLoads').innerHTML=scores.map(([id,s])=>'<div><b>'+h(rosterName(id))+' · '+s.total+'회</b><small>주심 '+s.roles.chief+' · 선심 '+(s.roles.line1+s.roles.line2)+' · 기록 '+s.roles.record+'</small></div>').join('')||'<p class="official-help">운영위원 이름을 입력하면 개인별 배정 횟수가 표시됩니다.</p>';
 $('#officialWarningCount').textContent=warningCount?('⚠ 확인 필요 '+warningCount+'건'):'배정 충돌 없음';
}
function roleChange(target){
 const mid=target.dataset.offRole,role=target.dataset.role,personId=target.value;
 const m=api.getState().matches[mid];if(!m||!ROLES.some(([r])=>r===role))return;
 if(personId){
  const check=statusFor(personId,m,role,data.assignments);
  if(check.block){alert(rosterName(personId)+' 배정 불가: '+check.reason);render();return;}
  if(check.soft&&!confirm(rosterName(personId)+' 학생은 이 날짜에 선수로 출전할 가능성이 있습니다. 잠정 배정 후 실제 출전 대진이 확정되면 다시 확인해야 해요. 그래도 배정할까요?')){render();return;}
 }
 const record=data.assignments[mid]||{};if(personId)record[role]=personId;else delete record[role];
 if(Object.keys(record).length)data.assignments[mid]=record;else delete data.assignments[mid];
 changed('운영위원 배정을 저장했어요.');
}
function autoFill(all){
 if(!api.canEdit())return;
 const known=data.members.filter(m=>m.name.trim()&&membersPlayingTeam(m).status!=='unknown');
 if(!known.length){alert('먼저 배구부 학생 이름을 입력하고, 대회 참가팀 또는 「경기 선수 아님」을 지정해 주세요.');return;}
 if(all&&!confirm('운영위원 배정을 전부 다시 만들까요? 기존 수동 배정도 모두 변경됩니다.'))return;
 if(all)data.assignments={};
 const games=allGames(),byDay=groupByDate(),counts=assignedStats();
 let filled=0,empty=0,provisional=0;
 const tieScore=id=>id.charCodeAt(1)*53+Number(id.slice(1))*17;
 for(const [date,dayGames] of byDay){
  for(const m of dayGames){
   const rec=data.assignments[m.id]||{};
   for(const [role] of ROLES){
    if(rec[role])continue;
    const avail=known.map(person=>({person,check:statusFor(person.id,m,role,data.assignments)})).filter(x=>!x.check.block);
    avail.sort((a,b)=>{
     if(!!a.check.soft!==!!b.check.soft)return a.check.soft?1:-1;
     const ca=counts[a.person.id],cb=counts[b.person.id];
     return ca.total-cb.total||ca.roles[role]-cb.roles[role]||tieScore(a.person.id)-tieScore(b.person.id);
    });
    const selected=avail[0];if(!selected){empty++;continue;}
    rec[role]=selected.person.id;data.assignments[m.id]=rec;counts[selected.person.id].total++;counts[selected.person.id].roles[role]++;filled++;
    if(selected.check.soft)provisional++;
   }
  }
 }
 changed(filled+'자리 자동 배정 · 미배정 '+empty+'자리'+(provisional?' · 잠정 '+provisional+'자리':''));
 if(empty||provisional)alert('자동 배정 결과: '+filled+'자리 배정, '+empty+'자리 미배정, '+provisional+'자리 출전 가능성 주의.\n미배정된 자리는 명단과 불참 날짜를 확인해 직접 수정해 주세요.');
}
function exportCsv(){
 const rows=[['날짜','경기','코트','경기명','주심','선심1','선심2','기록자','확인 사항']];
 for(const m of allGames()){
  const a=assignmentsFor(m.id),warnings=[];
  for(const [role,label] of ROLES)if(a[role]){const c=statusFor(a[role],m,role,data.assignments);if(c.reason)warnings.push(label+': '+c.reason);}
  rows.push([m.date,m.id,m.court,(m.g==='M'?'남':'여')+' '+m.round+m.index,...ROLES.map(([role])=>a[role]?rosterName(a[role]):''),warnings.join(' / ')]);
 }
 const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='외도초_대회_학생운영위원_배정표_비공개.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printRoster(){
 const rows=allGames().map(m=>{
  const a=assignmentsFor(m.id);
  return '<tr><td>'+h(dateLabel(m.date))+'</td><td>'+h(m.g==='M'?'남자':'여자')+' '+h(m.round+m.index)+'</td><td>'+m.court+'</td>'+ROLES.map(([r])=>'<td>'+h(a[r]?rosterName(a[r]):'-')+'</td>').join('')+'</tr>';
 }).join('');
 const popup=window.open('','_blank','width=1100,height=850');
 if(!popup){alert('인쇄 팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도하세요.');return;}
 popup.document.write('<!doctype html><html lang="ko"><meta charset="utf-8"><title>외도초 운영위원 배정표</title><style>body{font-family:sans-serif;padding:24px}h1{font-size:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:8px;text-align:center;font-size:12px}th{background:#eee}</style><h1>외도초 6학년 바운스발리볼 학급대항전 · 운영위원 배정표 (비공개)</h1><p>경기시간 08:10~08:50 · 주심1 / 선심2 / 기록1 · 운영위원 21명 순환</p><table><thead><tr><th>날짜</th><th>경기</th><th>코트</th><th>주심</th><th>선심1</th><th>선심2</th><th>기록자</th></tr></thead><tbody>'+rows+'</tbody></table></html>');
 popup.document.close();popup.focus();setTimeout(()=>popup.print(),300);
}
function init(hostApi){
 api=hostApi;data=fromDisk();
 if(!$('#view-officials')){
  const button=document.createElement('button');
  button.type='button';button.className='tab edit-only hidden';button.dataset.tab='officials';button.textContent='🧑‍⚖️ 운영위원 배정';
  const target=document.querySelector('.tabs [data-tab="share"]');
  target.parentNode.insertBefore(button,target);
  const section=document.createElement('section');
  section.id='view-officials';section.className='view hidden';
  section.innerHTML='<div class="section-head"><div><h2>🏐 배구부 학생 운영위원 배정</h2><p>21명의 배구부 학생이 주심·선심 2명·기록자를 돌아가며 맡아요. 경기 참가 학생은 같은 날짜의 운영위원에서 제외합니다.</p></div><span class="pill">관리자 전용 · 학생 이름 비공개</span></div>'+
   '<div class="official-summary" id="officialStats"></div>'+
   '<div class="official-note">① 21명 이름 입력 → ② 각 학생의 <b>대회 참가팀 또는 경기 선수 아님</b> 선택 → ③ <b>빈 자리 자동배정</b> 실행 → ④ 주심·선심·기록자를 수정해 확정하세요. 팀 선수 명단의 이름과 정확히 일치하면 참가팀을 자동 감지합니다. 아직 어느 팀이 올라올지 모르는 경기에는 <b>출전 가능성</b> 경고가 표시될 수 있어요. 승리팀 확정 후 반드시 재확인하세요.</div>'+
   '<div class="official-toolbar"><button id="officialAutoFill" class="btn primary">⚡ 빈 자리 자동배정</button><button id="officialAutoAll" class="btn">🔄 전체 다시 배정</button><button id="officialExport" class="btn">CSV 내려받기</button><button id="officialPrint" class="btn">배정표 인쇄</button><span id="officialWarningCount" class="pill">확인 중</span></div>'+
   '<div class="panel padded official-roster-wrap" style="margin-bottom:16px"><details id="officialRosterDetails"><summary style="cursor:pointer;font-size:16px;font-weight:900">👥 배구부 21명 명단 입력·수정 (펼치기)</summary>'+
   '<div class="official-bulk"><textarea id="officialBulkText" placeholder="배구부 학생 이름을 줄바꿈하여 붙여넣기&#10;홍길동&#10;김철수"></textarea><button type="button" id="officialBulkApply" class="btn">이름 일괄 등록</button></div>'+
   '<p class="official-help">이름만 입력하면 아직 출전 여부가 확인되지 않은 학생은 자동배정에서 제외됩니다. 반드시 본인의 참가팀을 연결하거나 「경기 선수 아님」을 선택하세요. 불가 날짜는 YYYY-MM-DD 형식으로 쉼표로 구분하세요.</p>'+
   '<div id="officialRosterBody" class="official-roster-grid"></div></details></div>'+
   '<div class="section-head"><div><h2>📅 날짜별 경기 운영위원 배정표</h2><p>같은 날짜에는 한 학생이 여러 경기를 맡지 못합니다. 출전 확정 및 예상 팀을 확인하여 충돌을 표시합니다.</p></div></div>'+
   '<div id="officialDays"></div><div class="panel padded"><b>⚖ 학생별 담당 횟수 · 역할 분포</b><div id="officialLoads" class="official-load"></div></div>'+
   '<p class="official-help" style="margin:12px 0">🔐 운영위원 명단과 배정 정보는 기존 Firebase의 관리자 전용 저장 공간에 보관하고, 학생들이 접속하는 공개 대진표에는 표시하지 않습니다. 출력·CSV도 내부용으로 사용해 주세요.</p>';
  const ref=document.getElementById('view-share');ref.parentNode.insertBefore(section,ref);
  section.addEventListener('change',event=>{
   if(!api.canEdit())return;
   const target=event.target;
   if(target.dataset.offName){const m=memberById(target.dataset.offName);if(!m)return;m.name=target.value.trim().slice(0,32);changed('운영위원 이름 저장');}
   else if(target.dataset.offTeam){const m=memberById(target.dataset.offTeam);if(!m)return;m.teamId=target.value;changed('학생 참가팀 상태 저장');}
   else if(target.dataset.offAbsent){const m=memberById(target.dataset.offAbsent);if(!m)return;m.unavailable=target.value.trim();changed('배정 제외 날짜 저장');}
   else if(target.dataset.offRole)roleChange(target);
  });
  $('#officialAutoFill').addEventListener('click',()=>autoFill(false));
  $('#officialAutoAll').addEventListener('click',()=>autoFill(true));
  $('#officialExport').addEventListener('click',exportCsv);
  $('#officialPrint').addEventListener('click',printRoster);
  $('#officialBulkApply').addEventListener('click',()=>{
   const names=$('#officialBulkText').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   if(!names.length){alert('학생 이름을 한 줄에 한 명씩 붙여넣어 주세요.');return;}
   if(names.length>CLUB_SIZE){alert('최대 21명까지만 등록할 수 있어요.');return;}
   if(!confirm(names.length+'명 이름을 1번부터 등록할까요? 기존에 입력한 해당 번호의 이름은 덮어씁니다.'))return;
   names.forEach((name,i)=>data.members[i].name=name.slice(0,32));
   $('#officialBulkText').value='';changed(names.length+'명 이름 등록 완료');
  });
 }
 if(api.canEdit())render();
}
window.OEDO_OFFICIALS={init,snapshot,privateLoad,importBackup,render};
})();