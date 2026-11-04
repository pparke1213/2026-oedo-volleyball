/* 외도초 6학년 바운스발리볼: 현장 단계별 대진 추첨 */
(function(){
  'use strict';
  const KEY='oedo-volleyball-live-draw-v1';
  const LABELS={M:'남학생부',W:'여학생부'};
  const PRE={M:[3],W:[1,3,5]};
  let api=null,gender='M',sessions={M:null,W:null},busy=false,rolling=null;

  function el(id){return document.getElementById(id);}
  function escapeText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
  function unbiasedRandom(max){
    if(!globalThis.crypto?.getRandomValues)return Math.floor(Math.random()*max);
    const array=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;
    do{globalThis.crypto.getRandomValues(array);}while(array[0]>=limit);
    return array[0]%max;
  }
  function teamName(id){return api.teamById(id)?.name||id;}
  function slotKinds(g){
    const items=[];let prelim=0;
    for(let q=0;q<8;q++){
      if(PRE[g].includes(q)){
        ++prelim;items.push({type:'pre',note:'예비전 '+prelim+'경기 · 1번 팀'});
        items.push({type:'pre',note:'예비전 '+prelim+'경기 · 2번 팀'});
      }else items.push({type:'bye',note:'8강 '+(Math.floor(q/2)+1)+'경기 · 부전승'});
    }
    return items;
  }
  function store(){try{localStorage.setItem(KEY,JSON.stringify(sessions));}catch(e){console.warn(e);}}
  function restore(){
    try{
      const saved=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!saved)return;
      for(const g of ['M','W']){
        const value=saved[g];
        const ids=api.getState().teams[g].map(t=>t.id);
        if(value&&Array.isArray(value.order)&&value.order.length<=ids.length&&new Set(value.order).size===value.order.length&&value.order.every(id=>ids.includes(id)))
          sessions[g]={order:value.order,committed:!!value.committed};
      }
    }catch(e){console.warn('추첨 상태 복구 실패',e);}
  }
  function render(){
    const s=sessions[gender],shown=s?.order.length||0,total=api.getState().teams[gender].length;
    document.querySelectorAll('[data-live-gender]').forEach(btn=>{
      const selected=btn.dataset.liveGender===gender;btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected));
    });
    el('drawStageTitle').textContent=LABELS[gender]+' · 대진표 자리 공개';
    el('drawStageCount').textContent=shown+' / '+total+'팀'+(s?.committed?' · 확정':'');
    el('drawStageProgress').style.width=(shown/total*100)+'%';
    el('drawStageNext').disabled=busy||!s||shown===total||s.committed;
    el('drawStageUndo').disabled=busy||!s||shown===0||s.committed;
    el('drawStageStart').disabled=busy;
    el('drawStageCommit').disabled=busy||!s||shown!==total||s.committed;
    if(!busy){
      el('drawStageLive').textContent=!s?'추첨을 시작해 주세요!':s.committed?'🏆 공식 대진 확정':shown===0?'첫 팀을 뽑아볼까요?':shown===total?'🎉 전원 공개 완료!':teamName(s.order[shown-1]);
      el('drawStageSubtitle').textContent=!s?'「새 추첨 준비」 버튼을 누르면 시작할 수 있어요.':s.committed?'토너먼트 대진표에서 최종 결과를 확인하세요.':shown===total?'「공식 대진 확정」을 누르세요.':shown+'번 자리 발표 완료! 다음 팀을 뽑아주세요.';
    }
    const slots=slotKinds(gender);
    el('drawStageSlots').innerHTML=slots.map((slot,i)=>{
      const visible=s&&i<shown,team=visible?teamName(s.order[i]):'？？？';
      return '<div class="draw-slot '+(visible?'chosen ':'')+(i===shown&&!s?.committed?'next':'')+'">'+
        '<span class="num">'+(i+1)+'번 자리</span><span class="name">'+escapeText(team)+'</span>'+
        '<span class="note '+slot.type+'">'+(slot.type==='bye'?'🟢 ':'🟠 ')+escapeText(slot.note)+'</span></div>';
    }).join('');
    el('drawStageMessage').textContent=!s?'팀 이름을 먼저 입력한 뒤 추첨을 진행해 주세요. 공개 전에는 기존 대진과 점수가 유지돼요.':s.committed?'공식 대진표에 반영된 상태입니다.':shown+'/'+total+'팀 공개 중 · 아직 기존 공식 대진표는 바뀌지 않았어요.';
  }
  function start(){
    if(!api.canEdit()||busy)return;
    const current=sessions[gender];
    if(current?.order.length&&!confirm(LABELS[gender]+'의 이전 추첨 내용을 지우고 다시 시작할까요? 기존 공식 대진은 바뀌지 않습니다.'))return;
    sessions[gender]={order:[],committed:false};store();render();
    api.toast('현장 추첨 준비 완료! 다음 팀을 공개해 주세요.');
  }
  function reveal(){
    if(!api.canEdit()||busy)return;
    const s=sessions[gender];if(!s||s.committed)return;
    const ids=api.getState().teams[gender].map(t=>t.id);
    const remaining=ids.filter(id=>!s.order.includes(id));
    if(!remaining.length)return;
    const chosen=remaining[unbiasedRandom(remaining.length)];
    busy=true;render();
    el('drawStageSubtitle').textContent=(s.order.length+1)+'번 자리를 추첨하고 있어요…';
    let tick=0;
    rolling=setInterval(()=>{el('drawStageLive').textContent='🎲 '+teamName(remaining[tick++%remaining.length]);},60);
    setTimeout(()=>{
      clearInterval(rolling);rolling=null;
      s.order.push(chosen);store();busy=false;render();
      el('drawStageLive').textContent='🎉 '+teamName(chosen);
    },950);
  }
  function undo(){
    if(!api.canEdit()||busy)return;
    const s=sessions[gender];if(!s||s.committed||!s.order.length)return;
    s.order.pop();store();render();api.toast('직전 추첨을 취소했어요.');
  }
  function applyDraw(){
    if(!api.canEdit()||busy)return;
    const g=gender,s=sessions[g],state=api.getState();
    if(!s||s.committed||s.order.length!==state.teams[g].length)return;
    const done=Object.values(state.matches).filter(m=>m.g===g&&m.winner).length;
    if(done&&!confirm('주의! 기존 '+LABELS[g]+' 경기 결과 '+done+'개가 삭제돼요. 계속할까요?'))return;
    if(!confirm(LABELS[g]+' '+s.order.length+'팀 추첨 결과를 공식 대진표로 확정할까요?\n해당 종별 기존 대진이 새로 만들어지고, 경기 일정도 남녀 균형 일정으로 다시 배치됩니다.'))return;
    for(const key of Object.keys(state.matches))if(key.startsWith(g+'-'))delete state.matches[key];
    const positions=[],order=s.order;let cursor=0,preNo=0;
    for(let i=0;i<8;i++){
      if(PRE[g].includes(i)){
        ++preNo;
        positions.push(api.newMatch(g,'P',preNo,
          {type:'team',id:order[cursor++]},{type:'team',id:order[cursor++]}));
      }else positions.push({type:'team',id:order[cursor++]});
    }
    const quarters=[],semis=[];
    for(let i=0;i<4;i++)quarters.push(api.newMatch(g,'Q',i+1,positions[i*2],positions[i*2+1]));
    for(let i=0;i<2;i++)semis.push(api.newMatch(g,'S',i+1,quarters[i*2],quarters[i*2+1]));
    api.newMatch(g,'F',1,semis[0],semis[1]);
    api.assignSchedule();
    s.committed=true;store();api.save();
    api.setBracketGender(g);api.render();api.setTab('bracket');
    api.toast(LABELS[g]+' 공식 대진표가 확정됐어요!');
  }
  function rebalanceSchedule(){
    if(!api.canEdit()||busy)return;
    if(!confirm('기존 경기별 날짜와 코트 설정을 새 기본 편성으로 초기화할까요?\n1~7일차 남녀 각 1경기, 8일차 여자 준결승 2경기, 9일차 남자 결승, 10일차 여자 결승입니다.'))return;
    api.assignSchedule();api.save();api.render();
    api.toast('남녀 균형 경기 일정으로 변경했어요.');
  }

  function init(hostApi){
    api=hostApi;restore();
    const tabTarget=document.querySelector('.tabs [data-tab="teams"]');
    const tab=document.createElement('button');
    tab.className='tab edit-only hidden';
    tab.dataset.tab='draw';tab.textContent='🎲 현장 대진 추첨';
    tabTarget.parentElement.insertBefore(tab,tabTarget);
    const section=document.createElement('section');
    section.id='view-draw';section.className='view hidden';
    section.innerHTML='<div class="section-head"><div><h2>🎲 학생들과 함께하는 현장 대진 추첨</h2><p>빔 프로젝터로 보여주고, 버튼을 누를 때마다 한 팀씩 공개해요. 모두 공개해야 공식 대진을 확정할 수 있어요.</p></div><span class="pill">관리자 전용</span></div>'+
      '<div class="draw-selector"><button type="button" data-live-gender="M">🔵 남학생부 9팀</button><button type="button" data-live-gender="W">🔴 여학생부 11팀</button></div>'+
      '<div class="draw-shell"><div><div class="draw-spotlight"><div class="overline">OEDO VOLLEYBALL · LIVE DRAW</div>'+
      '<div id="drawStageLive" class="draw-reveal" aria-live="polite">추첨 시작!</div><div id="drawStageSubtitle" class="draw-subtitle"></div>'+
      '<div class="draw-progress"><div id="drawStageProgress" style="width:0%"></div></div></div>'+
      '<div class="draw-actions"><button type="button" id="drawStageStart" class="btn">새 추첨 준비</button>'+
      '<button type="button" id="drawStageNext" class="btn draw-next">🎲 다음 팀 공개</button>'+
      '<button type="button" id="drawStageUndo" class="btn">↶ 직전 취소</button>'+
      '<button type="button" id="drawStageCommit" class="btn primary">✓ 공식 대진 확정</button></div>'+
      '<p id="drawStageMessage" class="draw-message"></p>'+
      '<div class="note"><b>안전한 진행:</b> 추첨 중 기존 대진·경기 점수는 유지돼요. 확정하면 해당 종별 대진만 새로 배치합니다. 팀당 4~6명 선수 명단은 그대로 유지됩니다.</div>'+
      '<div class="panel padded" style="margin-top:14px"><b>📅 남녀 균형 일정</b><p class="draw-message">처음 7일은 남자 1경기+여자 1경기, 8일차는 여자 준결승 2경기, 9~10일차는 남녀 결승을 하루 한 경기씩 운영합니다.</p>'+
      '<button type="button" id="drawStageRebalance" class="btn">현재 대진은 유지하고 일정만 다시 배치</button></div></div>'+
      '<div class="panel draw-side"><div class="stage-line"><b id="drawStageTitle">추첨 자리</b><span id="drawStageCount" class="stage-label"></span></div>'+
      '<div class="draw-slots" id="drawStageSlots"></div>'+
      '<p class="draw-message" style="margin-top:14px">🟢 부전승 = 8강 직행 · 🟠 예비전 = 한 경기 승리 후 8강 진출. 번호는 대진표 아래에서 왼쪽부터 세는 팀 자리 순서입니다.</p></div></div>';
    const bracket=document.getElementById('view-bracket');
    bracket.parentElement.insertBefore(section,bracket.nextSibling);
    document.getElementById('drawStageStart').addEventListener('click',start);
    document.getElementById('drawStageNext').addEventListener('click',reveal);
    document.getElementById('drawStageUndo').addEventListener('click',undo);
    document.getElementById('drawStageCommit').addEventListener('click',applyDraw);
    document.getElementById('drawStageRebalance').addEventListener('click',rebalanceSchedule);
    document.querySelectorAll('[data-live-gender]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;gender=b.dataset.liveGender;render();}));
    document.addEventListener('click',e=>{
      const btn=e.target.closest('#redraw,#redrawTeams');
      if(btn&&api.canEdit()){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        if(btn.id==='redraw')gender=api.getBracketGender();
        api.setTab('draw');render();
      }
    },true);
    tab.addEventListener('click',()=>render());
    document.getElementById('redraw').textContent='🎲 현장 추첨 열기';
    document.getElementById('redrawTeams').textContent='🎲 팀명 입력 완료 · 공개 추첨하기';
    if(!api.canEdit())tab.classList.add('hidden');
    render();
  }
  window.OEDO_STAGE_DRAW={init};
})();