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

/* 배정 전 남은 팀 수와 요일별 정원 점검. 이미 확정한 추첨은 유지합니다. */
function practiceCheck(){
 var grouped=classGroups(),as=assignments(),issues=[],remaining=[];
 if(grouped.missing.length)issues.push('학급이 미입력된 팀 '+grouped.missing.length+'개가 있어요. 참가팀·선수 명단에서 학급을 먼저 입력해 주세요.');
 grouped.groups.forEach(function(group){
  group.unassigned=group.teams.filter(function(t){return !as[t.id];});
  if(group.unassigned.length)remaining.push(group);
 });
 DAYS.forEach(function(d){if(countFor(d.date)>DAY_CAPACITY)issues.push(dateLabel(d.date)+'의 배정이 4팀을 초과합니다.');});
 Object.keys(as).forEach(function(id){
  if(!team(id)||!DAYS.some(function(d){return d.date===as[id];}))issues.push('이전 추첨 기록 중 잘못된 항목이 있어요. 기존 기록을 확인해 주세요.');
 });
 return {groups:grouped.groups,remaining:remaining,done:grouped.groups.length-remaining.length,issues:issues,spaces:DAYS.map(function(d){return Math.max(0,DAY_CAPACITY-countFor(d.date));})};
}
/* 5일×4팀 정원을 모두 채우며 같은 반의 팀들이 같은 날 만나는 경우를 최대화합니다.
   동점인 배정은 매 추첨마다 무작위로 선택하므로 날짜를 미리 고정하지 않습니다. */
function optimizePractice(status){
 var as=assignments(),groups=status.remaining.slice();
 var spaces=status.spaces.slice(),total=groups.reduce(function(n,g){return n+g.unassigned.length;},0);
 if(total!==spaces.reduce(function(a,b){return a+b;},0))return null;
 // 큰 학급을 우선 고려하여 계산 속도를 줄입니다. 동률은 무작위.
 var decorated=groups.map(function(g){return {g:g,r:randomIndex(1000000000)};});
 decorated.sort(function(a,b){return b.g.unassigned.length-a.g.unassigned.length||a.r-b.r;});
 groups=decorated.map(function(x){return x.g;});
 var layouts=groups.map(function(g){
  var n=g.unassigned.length,res=[],arr=Array(DAYS.length).fill(0);
  function visit(d,left){
   if(d===DAYS.length){
    if(left===0)res.push(arr.slice());
    return;
   }
   for(var count=0;count<=Math.min(left,spaces[d]);count++){
    arr[d]=count;visit(d+1,left-count);
   }
  }
  visit(0,n);
  // 이미 배정된 같은 반 팀과의 일치까지 함께 점수화
  var fixed=DAYS.map(function(d){return g.teams.filter(function(t){return as[t.id]===d.date;}).length;});
  return res.map(function(v){
   return {v:v,score:v.reduce(function(sum,count,d){return sum+fixed[d]*count+count*(count-1)/2;},0)};
  }).sort(function(a,b){return b.score-a.score;});
 });
 var memo=new Map();
 function best(i,cap){
  if(i===groups.length)return cap.every(function(x){return x===0;})?0:-Infinity;
  var key=i+'|'+cap.join('');
  if(memo.has(key))return memo.get(key);
  var max=-Infinity;
  layouts[i].forEach(function(layout){
   if(layout.v.some(function(n,d){return n>cap[d];}))return;
   var rest=cap.map(function(x,d){return x-layout.v[d];});
   var tail=best(i+1,rest);
   if(tail!==-Infinity)max=Math.max(max,layout.score+tail);
  });
  memo.set(key,max);
  return max;
 }
 if(best(0,spaces)===-Infinity)return null;
 var plan={},cap=spaces.slice();
 for(var i=0;i<groups.length;i++){
  var target=best(i,cap),options=[];
  layouts[i].forEach(function(layout){
   if(layout.v.some(function(n,d){return n>cap[d];}))return;
   var rest=cap.map(function(x,d){return x-layout.v[d];});
   if(layout.score+best(i+1,rest)===target)options.push(layout.v);
  });
  var layout=options[randomIndex(options.length)];
  if(!layout)return null;
  plan[groups[i].className]=layout;
  cap=cap.map(function(x,d){return x-layout[d];});
 }
 return plan;
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
   draw.textContent=check.remaining.length?'🎲 다음 추첨 · '+(check.done+1)+' / '+check.groups.length:'🎉 추첨 완료!';
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
   if(undoIds.length&&undoIds.every(function(id){return !!as[id];})&&ctx.canEdit()){
     announce.classList.remove('hidden');
     var key=classKey(team(undoIds[0])?.className);
     var uniqueDates=Array.from(new Set(undoIds.map(function(id){return as[id];})));
     var title=uniqueDates.length===1?'<div class="big-date">'+esc(dateLabel(uniqueDates[0]))+'</div>':'';
     var detail=undoIds.map(function(id){return '<div class="practice-reveal-line">'+esc(displayTeam(id))+' → '+esc(dateLabel(as[id]))+'</div>';}).join('');
     announce.innerHTML='<div class="team-name">🎉 '+esc(key)+' 추첨 결과</div>'+title+detail;
     if(lastRevealId!==undoIds.join(',')+uniqueDates.join(',')){announce.classList.remove('new-draw');void announce.offsetWidth;announce.classList.add('new-draw');lastRevealId=undoIds.join(',')+uniqueDates.join(',');}
   }else{announce.classList.add('hidden');announce.innerHTML='';lastRevealId=null;}
 }
 view.innerHTML=DAYS.map(function(d){
   var dayTeams=list.filter(function(t){return as[t.id]===d.date;});
   dayTeams.sort(function(a,b){return classKey(a.className).localeCompare(classKey(b.className),'ko',{numeric:true})||a.id.localeCompare(b.id);});
   var entries=dayTeams.map(function(t){
     return '<li><span class="team-kind">'+(t.id[0]==='M'?'남':'여')+'</span>'+esc(t.name)+' <span class="team-kind">'+esc(classKey(t.className))+'</span></li>';
   }).join('');
   for(var i=dayTeams.length;i<DAY_CAPACITY;i++)entries+='<li class="empty">미배정</li>';
   return '<article class="panel practice-day'+(dayTeams.length===DAY_CAPACITY?' is-full':'')+'"><header><h3>'+d.label+'</h3><span class="practice-count">'+dayTeams.length+' / '+DAY_CAPACITY+'팀</span></header><ol>'+entries+'</ol></article>';
 }).join('');
}

function draw(){
 if(!ctx||!ctx.canEdit())return;
 var now=Date.now();if(now-lastDrawAt<450)return;
 var status=practiceCheck();
 if(status.issues.length){ctx.toast(status.issues[0]);return;}
 if(!status.remaining.length){ctx.toast('연습일 추첨이 모두 끝났습니다.');return;}
 var plan=optimizePractice(status);
 if(!plan){ctx.toast('배정 가능한 일정이 없습니다. 학급 및 기존 추첨 기록을 확인해 주세요.');return;}
 var choice=status.remaining[randomIndex(status.remaining.length)];
 var layout=plan[choice.className],pool=choice.unassigned.slice();
 // 팀 순서와 동점 배정은 실제 무작위이며, 기존에 확정한 결과는 바꾸지 않습니다.
 for(var i=pool.length-1;i>0;i--){var k=randomIndex(i+1),temp=pool[i];pool[i]=pool[k];pool[k]=temp;}
 var p=statePractice(),ids=[];
 DAYS.forEach(function(d,day){
  for(var count=0;count<layout[day];count++){
   var t=pool.pop();
   if(t){p.assignments[t.id]=d.date;ids.push(t.id);}
  }
 });
 if(ids.length!==choice.unassigned.length){ctx.toast('추첨 처리에 실패했어요. 다시 시도해 주세요.');return;}
 p.lastGroupIds=ids;p.lastTeamId=ids[0];
 lastDrawAt=now;lastRevealId=null;ctx.save();ctx.render();ctx.toast('🎉 '+choice.className+' 추첨 완료!');
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
