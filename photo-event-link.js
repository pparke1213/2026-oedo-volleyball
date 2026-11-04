(function(){
'use strict';
const url=String(window.OEDO_PHOTO_SUBMIT_URL||'').trim();
const active=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(url);
const admin=new URLSearchParams(location.search).has('admin');
if(!active&&!admin)return;
const nav=document.querySelector('.tabs'),ref=nav?.querySelector('[data-tab="share"]');
const sectionRef=document.getElementById('view-share');
if(!nav||!ref||!sectionRef)return;
const b=document.createElement('button');b.className='tab'+(active?'':' edit-only');b.dataset.tab='photo';b.textContent='📸 포토 이벤트';nav.insertBefore(b,ref);
const sec=document.createElement('section');sec.id='view-photo';sec.className='view hidden';
sec.innerHTML='<div class="section-head"><div><h2>📸 찰칵! 바운스발리볼 포토 이벤트</h2><p>친구들의 멋진 경기 장면을 찍어 행운의 추첨에 참여하세요!</p></div></div>'+
'<div class="panel padded" style="max-width:720px;text-align:center;padding:28px"><div style="font-size:50px">📷</div>'+
'<h3>경기 사진 한 장, 행운의 기회!</h3><p class="muted">학급과 이름, 사진을 제출하면 참여 완료. 구글 로그인은 필요하지 않아요.</p>'+
'<div id="photoEventAction"></div><p class="tiny-note" style="margin-top:18px">제출 사진과 학생 이름은 담당 교사만 확인하며 공개 대진표에 표시하지 않습니다.</p></div>';
sectionRef.parentNode.insertBefore(sec,sectionRef);
const holder=sec.querySelector('#photoEventAction');
if(active){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.className='btn primary';link.style.cssText='display:inline-block;font-size:15px;padding:13px 21px';link.textContent='📸 사진 제출하기';holder.appendChild(link);}
else{const p=document.createElement('p');p.className='note';p.textContent='관리자 설정 안내: 아직 사진 제출 웹 앱 주소를 연결하지 않았습니다. 학생용 화면에는 이 메뉴가 보이지 않습니다.';holder.appendChild(p);}
})();