/* 외도초 2026 - 교사용 연습일 추첨 / 학생용 일정표 / 경기 전광판 */
(function(){
'use strict';
var DAYS=[
 {date:'2026-11-09',label:'11월 9일(월)'},
 {date:'2026-11-10',label:'11월 10일(화)'},
 {date:'2026-11-11',label:'11월 11일(수)'},
 {date:'2026-11-12',label:'11월 12일(목)'},
 {date:'2026-11-13',label:'11월 13일(금)'}
];
var ctx=null;
var lastRevealId=null;
var DAY_CAPACITY=4;
var lastDrawAt=0;
function el(id){return document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function teams(){var s=ctx.getState();return s.teams.M.concat(s.teams.W);}
function team(id){return teams().find(function(t){return t.id===id;});}
function displayTeam(id){var t=team(id);if(!t)return id;return (t.id+' · '+t.name+(t.className?' ('+t.className+')':''));}
function assignments(){var p=ctx.getState().practice;return p&&p.assignments&&typeof p.assignments==='object'?p.assignments:{};}
function countFor(date){return Object.values(assignments()).filter(function(v){return v===date;}).length;}
function allAssigned(){return Object.keys(assignments()).filter(function(id){return !!team(id);}).length;}
function statePractice(){var s=ctx.getState();if(!s.practice||typeof s.practice!=='object')s.practice={assignments:{},lastTeamId:null};if(!s.practice.assignments||typeof s.practice.assignments!=='object')s.practice.assignments={};return s.practice;}
function randomIndex(length){
 if(!length)return 0;
 if(window.crypto&&window.crypto.getRandomValues){
   var max=4294967296,limit=Math.floor(max/length)*length,x=new Uint32Array(1);
   do{window.crypto.getRandomValues(x);}while(x[0]>=limit);
   return x[0]%length;
 }
 return Math.floor(Math.random()*length);
}

/* 실제 참가팀의 학급을 기준으로 같은 반의 남녀 팀을 한 묶음으로 관리합니다. */
function classKey(value){
 var v=String(value||'').replace(/\s+/g,'').replace(/학년/g,'').replace(/반/g,'').replace(/[‐‑‒–—]/g,'-');
 if(!v)return '';
 var m=v.match(/^6[-.]?0?([1-9]|10)$/)||v.match(/^0?([1-9]|10)$/);
 return m?'6-'+Number(m[1]):v;
}
function classGroups(){
 var grouped=new Map(),missing=[];
 teams().forEach(function(t){
  var k=classKey(t.className);
  if(!k){missing.push(t.id+' · '+t.name);return;}
  if(!grouped.has(k))grouped.set(k,{className:k,teams:[]});
  grouped.get(k).teams.push(t);
 });
 return {groups:Array.from(grouped.values()),missing:missing};
}
/* 현재 남은 날짜별 빈자리로 나머지 학급 묶음이 전부 들어가는지를 검사합니다.
   잘못된 순서로 날짜를 뽑아 마지막에 4팀 정원을 맞출 수 없게 되는 상황을 방지합니다. */
function canPack(sizes,spaces){
 var ordered=sizes.slice().sort(function(a,b){return b-a;}),memo=new Set();
 if(ordered.some(function(n){return n>DAY_CAPACITY;}))return false;
 if(ordered.reduce(function(a,b){return a+b;},0)>spaces.reduce(function(a,b){return a+b;},0))return false;
 function check(i,cap){
  if(i===ordered.length)return true;
  var key=i+':'+cap.slice().sort(function(a,b){return b-a;}).join(',');
  if(memo.has(key))return false;
  var visited=new Set();
  for(var d=0;d<cap.length;d++){
   if(cap[d]<ordered[i]||visited.has(cap[d]))continue;
   visited.add(cap[d]);
   cap[d]-=ordered[i];
   if(check(i+1,cap)){cap[d]+=ordered[i];return true;}
   cap[d]+=ordered[i];
  }
  memo.add(key);return false;
 }
 return check(0,spaces.slice());
}
function practiceCheck(){
 var grouped=classGroups(),as=assignments(),issues=[],remaining=[],done=0;
 if(grouped.missing.length)issues.push('학급이 입력되지 않은 팀 '+grouped.missing.length+'개가 있어요. 「참가팀·선수 명단」에서 모든 팀의 학급을 먼저 입력해 주세요.');
 grouped.groups.forEach(function(group){
  if(group.teams.length>DAY_CAPACITY)issues.push(group.className+'에는 '+group.teams.length+'팀이 있어 하루 최대 4팀 제한을 초과합니다.');
  var dates=Array.from(new Set(group.teams.map(function(t){return as[t.id];}).filter(Boolean)));
  if(dates.length>1)issues.push(group.className+' 팀이 서로 다른 날짜로 배정되어 있어요. 「전체 추첨 초기화」 후 다시 추첨해 주세요.');
  else if(dates.length===1&&group.teams.some(function(t){return !as[t.id];}))
   issues.push(group.className+'의 팀 일부만 기존 방식으로 배정되어 있어요. 「전체 추첨 초기화」 후 다시 추첨해 주세요.');
  else if(!dates.length)remaining.push(group);
  else done++;
 });
 DAYS.forEach(function(d){if(countFor(d.date)>DAY_CAPACITY)issues.push(dateLabel(d.date)+'에 4팀을 초과해 배정되어 있어요.');});
 Object.keys(as).forEach(function(id){if(!team(id)||!DAYS.some(function(d){return d.date===as[id];}))issues.push('이전 기록 중 잘못된 배정이 있어요. 전체 추첨 초기화가 필요합니다.');});
 var spaces=DAYS.map(function(d){return Math.max(0,DAY_CAPACITY-countFor(d.date));});
 if(!issues.length&&!canPack(remaining.map(function(g){return g.teams.length;}),spaces))
  issues.push('현재 학급별 팀 수로는 하루 4팀씩 나누는 배정이 불가능합니다. 학급 및 팀 구성을 확인해 주세요.');
 return {groups:grouped.groups,remaining:remaining,done:done,issues:issues,spaces:spaces};
}

function dateLabel(date){return (DAYS.find(function(d){return d.date===date;})||{}).label||date;}
function dateKorean(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return date||'';
 var p=date.split('-').map(Number),d=new Date(p[0],p[1]-1,p[2],12);
 return p[1]+'월 '+p[2]+'일('+['일','월','화','수','목','금','토'][d.getDay()]+')';
}
function seoulToday(){
 var parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 var obj={};parts.forEach(function(p){obj[p.type]=p.value;});
 return obj.year+'-'+obj.month+'-'+obj.day;
}
function renderBoard(){
 var node=el('todayScoreboard');if(!node||!ctx)return;
 var s=ctx.getState(),ms=Object.values(s.matches||{}).filter(function(m){return !!m.date;}).sort(function(a,b){return a.date.localeCompare(b.date)||a.court-b.court;});
 if(!ms.length){node.innerHTML='';return;}
 var now=seoulToday(),hasToday=ms.some(function(m){return m.date===now;}),future=ms.filter(function(m){return m.date>now;});
 var date=hasToday?now:(future.length?future[0].date:ms[ms.length-1].date);
 var label=hasToday?'📣 오늘의 경기':(future.length?'📅 다음 경기':'🏁 마지막 경기 결과');
 var chosen=ms.filter(function(m){return m.date===date;});
 var cards=chosen.map(function(m){
   var parts=ctx.participants(m);
   var a=parts[0],b=parts[1],ta=a?team(a):null,tb=b?team(b):null;
   var na=ta?ta.name:'승리팀 대기',nb=tb?tb.name:'승리팀 대기';
   var p1='<span'+(m.winner===a&&a?' class="gameboard-winner"':'')+'>'+esc(na)+'</span>';
   var p2='<span'+(m.winner===b&&b?' class="gameboard-winner"':'')+'>'+esc(nb)+'</span>';
   var round=({P:'예비전',Q:'8강',S:'4강',F:'결승'})[m.round]||'경기';
   var g=m.g==='M'?'남학생부':'여학생부';
   return '<article class="gameboard-match"><div class="gameboard-meta"><span>'+g+' · '+round+'</span><span>'+esc(m.court)+'코트</span></div><div class="gameboard-pair">'+p1+' <span class="gameboard-vs">VS</span> '+p2+'</div><div class="gameboard-result">'+(m.winner?'✓ 결과 입력 완료'+(m.score?' · '+esc(m.score):''):'경기 예정 · 결과 입력 대기')+'</div></article>';
 }).join('');
 node.innerHTML='<div class="gameboard"><div class="gameboard-head"><div><h2>'+label+'</h2><p class="gameboard-note">오전 8:10~8:50 · 교사 입력 결과 자동 반영</p></div><span class="gameboard-day">'+dateKorean(date)+'</span></div><div class="gameboard-games">'+cards+'</div></div>';
}
function renderPractice(){
 var view=el('practiceDays');if(!view||!ctx)return;
 var as=assignments(),list=teams(),cnt=allAssigned(),total=list.length,check=practiceCheck();
 var count=el('practiceProgress');if(count)count.textContent=cnt+' / '+total+'팀 배정 완료';
 var draw=el('practiceDrawBtn');
 if(draw){
   draw.disabled=!ctx.canEdit()||!!check.issues.length||!check.remaining.length;
   draw.textContent=check.remaining.length?'🎲 다음 학급 추첨 · '+(check.done+1)+' / '+check.groups.length:'🎉 학급별 추첨 완료!';
 }
 var msg=el('practiceDrawMessage');
 if(msg){msg.textContent=check.issues.join('\n');msg.classList.toggle('hidden',!check.issues.length);}
 var admin=el('practiceAdmin');if(admin)admin.classList.toggle('hidden',!ctx.canEdit());
 var p=ctx.getState().practice||{};
 var undo=el('practiceUndoBtn');
 var undoIds=Array.isArray(p.lastGroupIds)?p.lastGroupIds:[];
 if(undo)undo.disabled=!ctx.canEdit()||!undoIds.length||!undoIds.every(function(id){return !!as[id];});
 var reset=el('practiceResetBtn');if(reset)reset.disabled=!ctx.canEdit()||cnt===0;
 var csv=el('practiceCsvBtn');if(csv)csv.disabled=!ctx.canEdit()||cnt===0;
 var announce=el('practiceReveal');
 if(announce){
   if(undoIds.length&&undoIds.every(function(id){return as[id]===as[undoIds[0]];})&&ctx.canEdit()){
     announce.classList.remove('hidden');
     var key=classKey(team(undoIds[0])?.className),names=undoIds.map(displayTeam).join(' / ');
     announce.innerHTML='<div class="team-name">🎉 '+esc(key)+' · '+undoIds.length+'팀 함께 배정</div><div class="big-date">'+esc(dateLabel(as[undoIds[0]]))+'</div><div class="team-name">'+esc(names)+'</div>';
     if(lastRevealId!==undoIds.join(',')){announce.classList.remove('new-draw');void announce.offsetWidth;announce.classList.add('new-draw');lastRevealId=undoIds.join(',');}
   }else{announce.classList.add('hidden');announce.innerHTML='';lastRevealId=null;}
 }
 view.innerHTML=DAYS.map(function(d){
   var groups=check.groups.map(function(g){return {className:g.className,teams:g.teams.filter(function(t){return as[t.id]===d.date;})};}).filter(function(g){return g.teams.length;});
   groups.sort(function(a,b){return a.className.localeCompare(b.className,'ko',{numeric:true});});
   var used=groups.reduce(function(n,g){return n+g.teams.length;},0);
   var entries=groups.map(function(g){
     var names=g.teams.map(function(t){return '<div class="practice-group-team"><span class="team-kind">'+(t.id[0]==='M'?'남':'여')+'</span>'+esc(t.name)+'</div>';}).join('');
     return '<li class="practice-group"><strong>'+esc(g.className)+'</strong><span class="practice-group-count">'+g.teams.length+'팀</span><div class="practice-group-teams">'+names+'</div></li>';
   }).join('');
   for(var i=used;i<DAY_CAPACITY;i++)entries+='<li class="empty">미배정</li>';
   return '<article class="panel practice-day'+(used===DAY_CAPACITY?' is-full':'')+'"><header><h3>'+d.label+'</h3><span class="practice-count">'+used+' / '+DAY_CAPACITY+'팀</span></header><ol>'+entries+'</ol></article>';
 }).join('');
}
function draw(){
 if(!ctx||!ctx.canEdit())return;
 var now=Date.now();if(now-lastDrawAt<450)return;
 var status=practiceCheck();
 if(status.issues.length){ctx.toast(status.issues[0]);return;}
 if(!status.remaining.length){ctx.toast('모든 학급의 연습일 추첨이 끝났습니다.');return;}
 // 남은 학급을 어떤 날짜에 배정하더라도 이후 나머지 학급의 정원 충족이 가능해야 합니다.
 var viableGroups=[];
 status.remaining.forEach(function(group){
  var dates=[];
  DAYS.forEach(function(d,i){
   var size=group.teams.length;
   if(status.spaces[i]<size)return;
   var leftover=status.spaces.slice();leftover[i]-=size;
   var rest=status.remaining.filter(function(g){return g!==group;}).map(function(g){return g.teams.length;});
   if(canPack(rest,leftover))dates.push(d.date);
  });
  if(dates.length)viableGroups.push({group:group,dates:dates});
 });
 if(!viableGroups.length){ctx.toast('남은 학급을 배정할 수 없습니다. 학급별 팀 수를 확인해 주세요.');return;}
 var choice=viableGroups[randomIndex(viableGroups.length)];
 var picked=choice.dates[randomIndex(choice.dates.length)];
 var p=statePractice(),ids=choice.group.teams.map(function(t){return t.id;});
 ids.forEach(function(id){p.assignments[id]=picked;});
 p.lastGroupIds=ids;
 p.lastTeamId=ids[0]; // 예전 데이터와의 호환성을 위해 유지
 lastDrawAt=now;lastRevealId=null;
 ctx.save();ctx.render();ctx.toast('🎉 '+choice.group.className+' · '+ids.length+'팀 → '+dateLabel(picked)+' 배정 완료!');
}
function undo(){
 if(!ctx||!ctx.canEdit())return;
 var p=statePractice(),ids=Array.isArray(p.lastGroupIds)?p.lastGroupIds:[];
 if(!ids.length||!ids.every(function(id){return !!p.assignments[id];}))return;
 var className=classKey(team(ids[0])?.className)||'최근 학급';
 if(!window.confirm(className+'의 최근 추첨 '+ids.length+'팀을 함께 취소할까요?'))return;
 ids.forEach(function(id){delete p.assignments[id];});
 p.lastGroupIds=null;p.lastTeamId=null;lastRevealId=null;
 ctx.save();ctx.render();ctx.toast('최근 학급 추첨을 취소했습니다.');
}
function reset(){
 if(!ctx||!ctx.canEdit()||!allAssigned())return;
 if(!window.confirm('점심시간 연습일 추첨 결과를 모두 삭제하고 처음부터 다시 시작할까요?'))return;
 if(!window.confirm('최종 확인: 20팀의 연습일 배정 기록이 모두 사라집니다. 계속할까요?'))return;
 var p=statePractice();p.assignments={};p.lastTeamId=null;p.lastGroupIds=null;lastRevealId=null;ctx.save();ctx.render();ctx.toast('추첨 기록을 초기화했습니다.');
}
function csv(){
 if(!ctx||!ctx.canEdit())return;
 var rows=[['연습 날짜','요일','운영 시간','팀 번호','팀명','학급','종별']];
 DAYS.forEach(function(d){teams().filter(function(t){return assignments()[t.id]===d.date;}).forEach(function(t){
  rows.push([d.date,d.label.match(/\((.)\)/)?.[1]||'','점심시간',t.id,t.name,t.className,t.id[0]==='M'?'남학생부':'여학생부']);
 });});
 function csvValue(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}
 var str='\uFEFF'+rows.map(function(r){return r.map(csvValue).join(',');}).join('\r\n');
 var blob=new Blob([str],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='외도초_바운스발리볼_점심연습일_추첨결과.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);ctx.toast('연습일 일정표 CSV를 저장했습니다.');
}
function init(api){
 ctx=api;
 var pick=el('practiceDrawBtn'),back=el('practiceUndoBtn'),clear=el('practiceResetBtn'),exportBtn=el('practiceCsvBtn');
 if(pick)pick.addEventListener('click',draw);
 if(back)back.addEventListener('click',undo);
 if(clear)clear.addEventListener('click',reset);
 if(exportBtn)exportBtn.addEventListener('click',csv);
 render();setInterval(renderBoard,60000);
}
function render(){if(!ctx)return;renderBoard();renderPractice();}
window.OEDO_PRACTICE_BOARD={init:init,render:render};
})();
