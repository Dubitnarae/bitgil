/**
 * 폰 브라우저에 보여줄 화면(한 파일). 코드는 폰에 기억해 두고, 틀리면 다시 묻는다.
 * 운영 화면(버튼 3개) + 설정 모드(편집 PIN: 조명 확인·주소 점검·위치 보정·채널 시험 — 노트북을 못 옮겨도 객석에서 하게).
 */
export const PAGE = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>빛길 원격</title>
<style>
body{margin:0;font-family:sans-serif;background:#111318;color:#eee;padding:16px;-webkit-user-select:none;user-select:none}
h1{font-size:18px;margin:0 0 12px}
.box{background:#1c1f27;border-radius:10px;padding:14px;margin-bottom:14px;line-height:1.7}
.big{font-size:22px;font-weight:bold}
.warn{color:#ff6b6b;font-weight:bold}
.hint{color:#9aa3b5;font-size:14px}
button{display:block;width:100%;font-size:22px;padding:22px;margin-bottom:14px;border:0;border-radius:12px;color:#fff;background:#2d6cdf}
button:disabled{opacity:.35}
#def{background:#3a7d44}#bo{background:#8a1c1c}#bo.on{background:#ff3b3b}
input,select{font-size:22px;width:100%;box-sizing:border-box;padding:10px;margin:8px 0;text-align:center;background:#262a33;color:#eee;border:1px solid #3a404c;border-radius:8px}
#login,#main,#setup{display:none}
#sent{text-align:center;color:#6ee07a;font-weight:bold;min-height:1.4em}
#toSetup{background:#3a404c;font-size:16px;padding:14px}
.s button{font-size:17px;padding:14px;margin-bottom:8px;background:#2f3542}
.s button.go{background:#2d6cdf}.s button.ok{background:#3a7d44}.s button.stop{background:#8a1c1c}
.row{display:flex;gap:8px;align-items:center}.row>*{flex:1}
.row b{flex:0 0 22px;text-align:center}
.tabs{display:flex;gap:6px;margin-bottom:10px}.tabs button{margin:0;padding:12px 4px;font-size:15px}
.tabs button.act{background:#2d6cdf}
.fid{font-size:34px;font-weight:bold;color:#ffd54a}
</style></head><body>
<h1>빛길 원격</h1>
<div id="login">
  <div class="box">노트북 빛길 → 편집 모드 → 설정에 있는 <b>원격 접속 코드</b>를 넣으세요.
  <input id="code" inputmode="numeric" maxlength="6"><button id="go">연결</button>
  <div id="msg" class="warn"></div></div>
</div>
<div id="main">
  <div class="box">
    <div>지금: <span class="big" id="scene"></span></div>
    <div>순서: <span id="pos"></span> · 다음: <span id="next"></span></div>
    <div>전체 밝기 <span id="master"></span> · <span id="out"></span></div>
    <div id="state"></div>
  </div>
  <button id="nx">다음 씬 ▶</button>
  <button id="def">기본 조명</button>
  <button id="bo">블랙아웃</button>
  <div id="sent"></div>
  <button id="toSetup">⚙ 설정 모드 (조명 확인·주소·위치)</button>
</div>

<div id="setup" class="s">
  <div class="row"><button id="back">◀ 운영 화면</button><button id="lock" class="stop">설정 모드 닫기</button></div>
  <div id="pinBox" class="box"><span id="pinTxt"></span> 열면 노트북도 편집 모드가 되고, 10분 동안 조작이 없으면 닫힙니다.
    <input id="pin" type="password" inputmode="numeric" maxlength="4"><button id="pinGo" class="go">설정 모드 열기</button>
    <div id="pinMsg" class="warn"></div></div>
  <div id="work">
    <div id="sWarn"></div>
    <div class="tabs"><button data-t="ok">조명 확인</button><button data-t="addr">주소</button><button data-t="pos">위치</button><button data-t="ch">채널 시험</button></div>
    <div id="fx">
      <div id="fxOff" class="box">조명 하나만 흰색으로 바로 켜고 나머지는 끕니다(실제 조명이 바로 바뀝니다).
        <button id="fStart" class="go">조명 찾기 시작</button><div class="hint" id="fCount"></div></div>
      <div id="fxOn">
        <div class="box"><span class="fid" id="fId"></span> <span id="fInfo" class="hint"></span>
          <div class="row"><button id="fPrev">◀ 이전</button><button id="fNext">다음 ▶</button></div>
          <button id="fUn">다음 미확인 ▶</button>
          <select id="fList"></select>
          <button id="fEnd" class="stop">찾기 끝 (원래 조명으로)</button></div>
        <div id="tOk" class="box">켜진 조명이 3D(노트북)의 이 자리 조명과 같으면 확인을 누르세요. <span id="vCount" class="hint"></span>
          <button id="vBtn" class="ok"></button></div>
        <div id="tAddr" class="box">DMX 주소 <span id="aNow" class="hint"></span>
          <input id="aIn" type="number" inputmode="numeric" min="1" max="512">
          <button id="aSave" class="go">주소 바꾸기</button><div id="aWarn" class="warn"></div>
          <div class="hint">엉뚱한 조명이 켜지면 주소를 고치거나, [위치] 탭에서 그 조명과 자리를 바꾸세요. 주소마다 확인은 [채널 시험] 탭.</div></div>
        <div id="tPos" class="box">3D 위치 (m) <span class="hint">x 오른쪽 · y 높이 · z 좌석 쪽</span>
          <div id="pRows"></div><button id="pSave" class="go">위치 저장</button>
          설치 방향<select id="dir"><option value="down">천장 · 아래로</option><option value="aimed">천장 · 한 곳을 겨눔</option><option value="up">바닥 · 위로</option><option value="pan_tilt">바닥 · 무빙(팬·틸트)</option></select>
          <div id="aimBox">조준점 (빛이 닿는 곳, m)<div id="mRows"></div><button id="mSave" class="go">조준점 저장</button></div>
          다른 조명과 자리 바꾸기 <span class="hint">(주소는 그대로, 위치·방향만 맞바꿈)</span>
          <select id="swap"></select><button id="swGo">자리 바꾸기</button></div>
      </div>
    </div>
    <div id="tCh" class="box">DMX 채널 하나만 바로 켜고 나머지는 모두 끕니다. 밝기 채널이 따로 있는 조명은 이것만으로 안 켜질 수 있습니다.
      <div id="chOff"><input id="chIn" type="number" inputmode="numeric" min="1" max="512" value="1"><button id="chGo" class="go">시험 시작</button></div>
      <div id="chOn"><div>지금 채널 <span class="fid" id="chNow"></span></div>
        <div class="row"><button id="chPrev">◀ 이전</button><button id="chNext">다음 ▶</button></div>
        값 <span id="chV"></span><input id="chVal" type="range" min="0" max="255">
        <button id="chEnd" class="stop">시험 끝</button></div>
    </div>
    <div id="sMsg" class="warn"></div>
  </div>
</div>
<p style="text-align:center"><a href="/app/" style="color:#8fb4ff">노트북처럼 전체 화면(3D 포함)으로 열기 →</a></p>
<p style="color:#7d8596;font-size:12px;text-align:center">빛길 · 개발자 KIM YEONGDO</p>
<script>
var $=function(id){return document.getElementById(id)}, st=null, es=null, view='main', tab='ok', form=null, listSig='';
var q=new URLSearchParams(location.search).get('code');
if(q){localStorage.setItem('bitgil-code',q);history.replaceState(null,'','/')} // QR로 들어오면 코드를 기억하고 주소창에서 지움
var code=localStorage.getItem('bitgil-code')||'';
var vis=function(id,on){$(id).style.display=on?'block':'none'};
function show(login,msg){vis('login',login);vis('main',!login&&view==='main');vis('setup',!login&&view==='setup');$('msg').textContent=msg||''}
function connect(){
  if(es)es.close();
  es=new EventSource('/events?code='+encodeURIComponent(code));
  es.onmessage=function(e){st=JSON.parse(e.data);show(false);draw()};
  es.onerror=function(){ if(es.readyState===2){ show(true,'코드가 틀렸거나 연결이 막혔습니다(5번 틀리면 1분 잠김).') }
    else { $('state').innerHTML=$('sWarn').innerHTML='<span class="warn">노트북과 연결이 끊겼습니다. 다시 연결 중…</span>' } };
}
function draw(){
  $('scene').textContent=st.scene;
  $('pos').textContent=st.total? (st.cue+1)+' / '+st.total : '순서 목록 없음';
  $('next').textContent=st.next||'없음';
  $('master').textContent=Math.round(st.master*100)+'%';
  $('out').innerHTML=st.output?'장비로 출력 중':'<span class="warn">출력 대기(장비로 안 나감)</span>';
  $('state').innerHTML=st.blackout?'<span class="warn">블랙아웃 켜짐</span>':st.fading?'페이드 중…':'';
  $('nx').disabled=!st.next;
  $('bo').className=st.blackout?'on':'';
  $('bo').textContent=st.blackout?'블랙아웃 끄기':'블랙아웃';
  drawSetup();
}
var sentT=0;
function done(){
  if(navigator.vibrate)navigator.vibrate(40); // 눌렸다는 짧은 진동(아이폰은 안 됨)
  $('sent').textContent='보냄 ✓';clearTimeout(sentT);sentT=setTimeout(function(){$('sent').textContent=''},1500);
}
function cmd(q){fetch('/cmd?code='+encodeURIComponent(code)+'&'+q,{method:'POST'}).then(function(r){
  if(!r.ok)return alert('명령이 거절되었습니다('+r.status+')');
  done();
},function(){alert('노트북에 보내지 못했습니다')})}
$('go').onclick=function(){code=$('code').value.trim();localStorage.setItem('bitgil-code',code);connect()};
$('nx').onclick=function(){ if(st&&st.next&&confirm('"'+st.next+'"(으)로 진행할까요?\\n실제 조명이 바로 바뀝니다.'))cmd('c=next') };
$('def').onclick=function(){cmd('c=default')};
$('bo').onclick=function(){cmd('c=blackout&on='+(st&&st.blackout?0:1))};

// ── 설정 모드 ──
function setup(c,then){
  $('sMsg').textContent='';
  fetch('/setup?code='+encodeURIComponent(code),{method:'POST',body:JSON.stringify(c)}).then(function(r){
    if(r.ok){if(navigator.vibrate)navigator.vibrate(30);if(then)then();return}
    r.text().then(function(t){$('sMsg').textContent=t||('거절됨('+r.status+')')});
  },function(){$('sMsg').textContent='노트북에 보내지 못했습니다'});
}
$('toSetup').onclick=function(){view='setup';show(false);drawSetup()};
$('back').onclick=function(){view='main';show(false)};
$('pinGo').onclick=function(){
  fetch('/unlock?code='+encodeURIComponent(code)+'&pin='+encodeURIComponent($('pin').value),{method:'POST'}).then(function(r){
    $('pin').value='';$('pinMsg').textContent=r.ok?'':'PIN이 틀렸습니다(5번 틀리면 1분 잠김)';
  },function(){$('pinMsg').textContent='노트북에 보내지 못했습니다'});
};
$('lock').onclick=function(){ if(st&&st.edit)setup({t:'lock'}); view='main';show(false) };
var tabs=document.querySelectorAll('.tabs button');
for(var i=0;i<tabs.length;i++)tabs[i].onclick=function(){
  tab=this.getAttribute('data-t');
  if(tab==='ch'&&st.setup.find)setup({t:'find',id:null}); // 조명 찾기와 채널 시험은 하나씩
  if(tab!=='ch'&&st.setup.chTest)setup({t:'chTest',ch:null});
  drawSetup();
};
function fxs(){return st.setup.fixtures}
function cur(){var s=st.setup;for(var i=0;i<s.fixtures.length;i++)if(s.fixtures[i].id===s.find)return s.fixtures[i];return null}
function go(id){setup({t:'find',id:id})}
function step(d){var l=fxs(),i=l.indexOf(cur());go(l[(i+d+l.length)%l.length].id)}
$('fStart').onclick=function(){var l=fxs(),f=l.filter(function(x){return !x.verified})[0]||l[0];go(f.id)};
$('fPrev').onclick=function(){step(-1)};$('fNext').onclick=function(){step(1)};
$('fUn').onclick=function(){var l=fxs(),i=l.indexOf(cur());for(var k=1;k<=l.length;k++){var f=l[(i+k)%l.length];if(!f.verified)return go(f.id)}$('sMsg').textContent='모두 확인됐습니다'};
$('fList').onchange=function(){go(this.value)};
$('fEnd').onclick=function(){go(null)};
$('vBtn').onclick=function(){var f=cur();setup({t:'editFixture',id:f.id,edit:{verified:!f.verified}})};
$('aSave').onclick=function(){var f=cur(),a=Number($('aIn').value);setup({t:'editFixture',id:f.id,edit:{address:a}},function(){form=null})};
// 위치·조준점: −/+ 버튼으로 0.1m씩 고치고 [저장]을 눌러야 쇼 파일에 들어간다
function rows(el,key){
  var h='';['x','y','z'].forEach(function(k){h+='<div class="row"><b>'+k+'</b><button data-k="'+key+k+'" data-d="-1">−</button><input id="'+key+k+'" type="number" step="0.1" inputmode="decimal"><button data-k="'+key+k+'" data-d="1">＋</button></div>'});
  $(el).innerHTML=h;
  var bs=$(el).querySelectorAll('button');
  for(var i=0;i<bs.length;i++)bs[i].onclick=function(){var inp=$(this.getAttribute('data-k'));inp.value=Math.round((Number(inp.value)+0.1*Number(this.getAttribute('data-d')))*1000)/1000}; // 0.1씩, 원래 값의 소수점은 그대로(소수 오차만 정리)
}
rows('pRows','p');rows('mRows','m');
var vec=function(key){return {x:Number($(key+'x').value),y:Number($(key+'y').value),z:Number($(key+'z').value)}};
$('pSave').onclick=function(){setup({t:'editFixture',id:cur().id,edit:{position:vec('p')}},function(){form=null})};
$('mSave').onclick=function(){setup({t:'editFixture',id:cur().id,edit:{aim:vec('m')}},function(){form=null})};
$('dir').onchange=function(){setup({t:'editFixture',id:cur().id,edit:{direction:this.value}})};
$('swGo').onclick=function(){var f=cur(),o=$('swap').value;if(o&&confirm(f.id+' 와 '+o+' 의 위치·방향을 맞바꿀까요?'))setup({t:'swapFixtures',a:f.id,b:o},function(){form=null})};
function ch(c,v){setup({t:'chTest',ch:((c-1+512)%512)+1,value:v===undefined?Number($('chVal').value):v})}
$('chGo').onclick=function(){ch(Number($('chIn').value)||1,255)};
$('chPrev').onclick=function(){ch(st.setup.chTest.ch-1)};$('chNext').onclick=function(){ch(st.setup.chTest.ch+1)};
$('chVal').oninput=function(){ch(st.setup.chTest.ch)};
$('chEnd').onclick=function(){$('chIn').value=st.setup.chTest.ch;setup({t:'chTest',ch:null})};

function drawSetup(){
  if(!st||view!=='setup')return;
  vis('pinBox',!st.edit);vis('work',st.edit);$('lock').disabled=!st.edit;
  if(!st.edit){form=null;vis('pin',!st.pinOff);$('pinTxt').textContent=st.pinOff?'PIN 사용이 꺼져 있어 PIN 없이 열립니다.':'편집 모드 PIN(노트북과 같은 4자리)을 넣으세요.';return}
  var s=st.setup,f=cur();
  $('sWarn').innerHTML=(st.output?'':'<div class="warn">출력 대기 중이라 실제 조명은 안 켜집니다. 노트북에서 [출력 켜기]를 누르세요.</div>')+(st.blackout?'<div class="warn">블랙아웃 중이라 조명이 꺼져 있습니다.</div>':'');
  for(var i=0;i<tabs.length;i++)tabs[i].className=tabs[i].getAttribute('data-t')===tab?'act':'';
  vis('fx',tab!=='ch');vis('tCh',tab==='ch');
  vis('fxOff',!f);vis('fxOn',!!f);
  var nv=s.fixtures.filter(function(x){return x.verified}).length;
  $('fCount').textContent=$('vCount').textContent='확인됨 '+nv+' / '+s.fixtures.length+'대';
  var sig=s.fixtures.map(function(x){return x.id+x.verified}).join();
  if(sig!==listSig){listSig=sig;$('fList').innerHTML=s.fixtures.map(function(x){return '<option value="'+x.id+'">'+(x.verified?'✓ ':'· ')+x.id+' ('+x.batten+')</option>'}).join('')}
  if(f){
    $('fList').value=f.id;
    $('fId').textContent=f.id;
    $('fInfo').textContent=f.type+' · DMX '+f.address+'~'+(f.address+f.count-1)+' · '+f.batten;
    vis('tOk',tab==='ok');vis('tAddr',tab==='addr');vis('tPos',tab==='pos');
    $('vBtn').textContent=f.verified?'✓ 확인됨 (누르면 취소)':'실물과 맞음 — 확인';$('vBtn').className=f.verified?'':'ok';
    $('aNow').textContent='지금 '+f.address+'~'+(f.address+f.count-1)+' ('+f.count+'채널)';
    $('aWarn').textContent=f.clash.length?'채널이 겹치는 조명: '+f.clash.join(', '):'';
    $('dir').value=f.direction;vis('aimBox',f.direction==='aimed');
    // 입력 칸은 다른 조명으로 넘어갔거나 저장했을 때만 새로 채운다(고치는 중에 덮어쓰지 않게)
    if(!form||form!==f.id){
      form=f.id;$('aIn').value=f.address;
      var a=f.aim||{x:f.position.x,y:0,z:f.position.z};
      ['x','y','z'].forEach(function(k){$('p'+k).value=f.position[k];$('m'+k).value=a[k]});
      var same=s.fixtures.filter(function(o){return o.id!==f.id&&o.batten===f.batten}),other=s.fixtures.filter(function(o){return o.id!==f.id&&o.batten!==f.batten});
      $('swap').innerHTML='<optgroup label="같은 줄 ('+f.batten+')">'+same.map(function(o){return '<option>'+o.id+'</option>'}).join('')+'</optgroup><optgroup label="다른 줄">'+other.map(function(o){return '<option value="'+o.id+'">'+o.id+' ('+o.batten+')</option>'}).join('')+'</optgroup>';
    }
  }
  vis('chOff',!s.chTest);vis('chOn',!!s.chTest);
  if(s.chTest){$('chNow').textContent=s.chTest.ch;$('chV').textContent=s.chTest.value;if(document.activeElement!==$('chVal'))$('chVal').value=s.chTest.value}
}
if(code)connect();else show(true);
</script></body></html>`


/**
 * 원격 전체 화면(/app/)용 연결 스크립트: 노트북 프로그램의 window.bitgil(Electron 내부 통신)을 같은 이름의 HTTP 요청으로 바꾼다.
 * 기능 이름은 src/preload/index.ts 와 같아야 한다. 접속 코드는 폰 화면과 같이 localStorage 'bitgil-code' 에 기억.
 */
export const BRIDGE = `(function(){
var q=new URLSearchParams(location.search).get('code');
if(q){localStorage.setItem('bitgil-code',q);history.replaceState(null,'',location.pathname)}
var code=localStorage.getItem('bitgil-code')||'';
if(!code){code=(prompt('빛길 원격 접속 코드 6자리 (노트북 설정 화면에 있음)')||'').trim();localStorage.setItem('bitgil-code',code)}
var enc=encodeURIComponent(code);
function fail(r){if(r.status===401){localStorage.removeItem('bitgil-code');alert('접속 코드가 틀렸거나 잠겼습니다(5번 틀리면 1분). 새로고침 후 다시 넣어 주세요.')}throw new Error('원격 요청 실패 '+r.status)}
function call(name){var args=[].slice.call(arguments,1);return fetch('/api/'+name+'?code='+enc,{method:'POST',body:JSON.stringify(args)}).then(function(r){return r.ok?r.json():fail(r)})}
var subs={state:[],show:[]},es=null;
function open(){es=new EventSource('/app-events?code='+enc);
  ['state','show'].forEach(function(k){es.addEventListener(k,function(e){var v=JSON.parse(e.data);subs[k].forEach(function(cb){cb(v)})})});
  es.onerror=function(){document.title='빛길 (연결 끊김 — 다시 연결 중)'};es.onopen=function(){document.title='빛길 (원격)'}}
function on(k){return function(cb){subs[k].push(cb);if(!es)open();return function(){subs[k]=subs[k].filter(function(x){return x!==cb})}}}
var b={send:function(c){call('send',c).catch(function(e){console.error(e)})},onState:on('state'),onShow:on('show')};
['getShow','getState','listPorts','udmxDriverState','udmxInstallDriver','unlock','setPin','pinEnabled','lock','xhdImport','xhdExport','showExport','showImport'].forEach(function(n){b[n]=call.bind(null,n)});
window.bitgil=b;
})()`
