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
 node.innerHTML='<div class="gameboard"><div class="gameboard-head"><div><h2>'+label+'</h2><p class="gameboard-note">오전 8:10~8:50 · 실시간으로 결과 반영</p></div><span class="gameboard-day">'+dateKorean(date)+'</span></div><div class="gameboard-games">'+cards+'</div></div>';
}
function renderPractice(){
 var view=el('practiceDays');if(!view||!ctx)return;
 var as=assignments(),list=teams(),cnt=allAssigned(),total=list.length;
 var count=el('practiceProgress');if(count)count.textContent=cnt+' / '+total+'팀 배정 완료';
 var remaining=list.filter(function(t){return !as[t.id];});
 var select=el('practiceTeamSelect');
 if(select){
   var previous=select.value;
   select.innerHTML='<option value="">-- 추첨할 팀 선택 --</option>'+remaining.map(function(t){return '<option value="'+esc(t.id)+'">'+esc(displayTeam(t.id))+'</option>';}).join('');
   if(remaining.some(function(t){return t.id===previous;}))select.value=previous;
   select.disabled=!ctx.canEdit()||!remaining.length;
 }
 var draw=el('practiceDrawBtn');if(draw)draw.disabled=!ctx.canEdit()||!remaining.length;
 var admin=el('practiceAdmin');if(admin)admin.classList.toggle('hidden',!ctx.canEdit());
 var undo=el('practiceUndoBtn');if(undo)undo.disabled=!ctx.canEdit()||!ctx.getState().practice?.lastTeamId||!as[ctx.getState().practice.lastTeamId];
 var reset=el('practiceResetBtn');if(reset)reset.disabled=!ctx.canEdit()||cnt===0;
 var csv=el('practiceCsvBtn');if(csv)csv.disabled=!ctx.canEdit()||cnt===0;
 var last=ctx.getState().practice?.lastTeamId||null;
 var announce=el('practiceReveal');
 if(announce){
   if(last&&as[last]&&ctx.canEdit()){
     announce.classList.remove('hidden');
     announce.innerHTML='<div class="team-name">🎉 방금 뽑은 팀: '+esc(displayTeam(last))+'</div><div class="big-date">'+esc(dateLabel(as[last]))+'</div><div>점심시간 체육관 연습일 확정!</div>';
     if(lastRevealId!==last){announce.classList.remove('new-draw');void announce.offsetWidth;announce.classList.add('new-draw');lastRevealId=last;}
   }else{announce.classList.add('hidden');announce.innerHTML='';lastRevealId=null;}
 }
 view.innerHTML=DAYS.map(function(d){
   var ids=list.filter(function(t){return as[t.id]===d.date;});
   var entries=ids.map(function(t){return '<li><span class="team-kind">'+(t.id[0]==='M'?'남':'여')+'</span>'+esc(t.name)+(t.className?' <span class="team-kind">'+esc(t.className)+'</span>':'')+'</li>';}).join('');
   for(var i=ids.length;i<DAY_CAPACITY;i++)entries+='<li class="empty">미배정</li>';
   return '<article class="panel practice-day'+(ids.length===DAY_CAPACITY?' is-full':'')+'"><header><h3>'+d.label+'</h3><span class="practice-count">'+ids.length+' / '+DAY_CAPACITY+'팀</span></header><ol>'+entries+'</ol></article>';
 }).join('');
}
function draw(){
 if(!ctx||!ctx.canEdit())return;
 var select=el('practiceTeamSelect'),id=select?.value;
 if(!id){ctx.toast('추첨할 팀을 먼저 선택해 주세요.');return;}
 if(!team(id)||assignments()[id]){ctx.toast('이미 배정되었거나 존재하지 않는 팀이에요.');return;}
 var available=[];
 DAYS.forEach(function(d){var open=Math.max(0,DAY_CAPACITY-countFor(d.date));for(var i=0;i<open;i++)available.push(d.date);});
 if(!available.length){ctx.toast('모든 연습일 배정이 끝났습니다.');return;}
 var picked=available[randomIndex(available.length)],p=statePractice();
 p.assignments[id]=picked;p.lastTeamId=id;
 lastRevealId=null;ctx.save();ctx.render();ctx.toast('🎉 '+displayTeam(id)+' → '+dateLabel(picked)+' 배정 완료!');
}
function undo(){
 if(!ctx||!ctx.canEdit())return;var p=statePractice(),id=p.lastTeamId;
 if(!id||!p.assignments[id])return;
 if(!window.confirm(displayTeam(id)+'의 최근 추첨 결과를 취소할까요?'))return;
 delete p.assignments[id];p.lastTeamId=null;lastRevealId=null;ctx.save();ctx.render();ctx.toast('최근 추첨 1건을 취소했습니다.');
}
function reset(){
 if(!ctx||!ctx.canEdit()||!allAssigned())return;
 if(!window.confirm('점심시간 연습일 추첨 결과를 모두 삭제하고 처음부터 다시 시작할까요?'))return;
 if(!window.confirm('최종 확인: 20팀의 연습일 배정 기록이 모두 사라집니다. 계속할까요?'))return;
 var p=statePractice();p.assignments={};p.lastTeamId=null;lastRevealId=null;ctx.save();ctx.render();ctx.toast('추첨 기록을 초기화했습니다.');
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
