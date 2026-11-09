/** 폰 브라우저에 보여줄 화면(한 파일). 코드는 폰에 기억해 두고, 틀리면 다시 묻는다. */
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
button{display:block;width:100%;font-size:22px;padding:22px;margin-bottom:14px;border:0;border-radius:12px;color:#fff;background:#2d6cdf}
button:disabled{opacity:.35}
#def{background:#3a7d44}#bo{background:#8a1c1c}#bo.on{background:#ff3b3b}
input{font-size:24px;width:100%;box-sizing:border-box;padding:12px;margin:10px 0;text-align:center}
#login,#main{display:none}
#sent{text-align:center;color:#6ee07a;font-weight:bold;min-height:1.4em}
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
</div>
<p style="color:#7d8596;font-size:12px;text-align:center">빛길 · 개발자 KIM YEONGDO</p>
<script>
var $=function(id){return document.getElementById(id)}, st=null, es=null;
var q=new URLSearchParams(location.search).get('code');
if(q){localStorage.setItem('bitgil-code',q);history.replaceState(null,'','/')} // QR로 들어오면 코드를 기억하고 주소창에서 지움
var code=localStorage.getItem('bitgil-code')||'';
function show(login,msg){$('login').style.display=login?'block':'none';$('main').style.display=login?'none':'block';$('msg').textContent=msg||''}
function connect(){
  if(es)es.close();
  es=new EventSource('/events?code='+encodeURIComponent(code));
  es.onmessage=function(e){st=JSON.parse(e.data);show(false);draw()};
  es.onerror=function(){ if(es.readyState===2){ show(true,'코드가 틀렸거나 연결이 막혔습니다(5번 틀리면 1분 잠김).') }
    else { $('state').innerHTML='<span class="warn">노트북과 연결이 끊겼습니다. 다시 연결 중…</span>' } };
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
}
var sentT=0;
function cmd(q){fetch('/cmd?code='+encodeURIComponent(code)+'&'+q,{method:'POST'}).then(function(r){
  if(!r.ok)return alert('명령이 거절되었습니다('+r.status+')');
  if(navigator.vibrate)navigator.vibrate(40); // 눌렸다는 짧은 진동(아이폰은 안 됨)
  $('sent').textContent='보냄 ✓';clearTimeout(sentT);sentT=setTimeout(function(){$('sent').textContent=''},1500);
},function(){alert('노트북에 보내지 못했습니다')})}
$('go').onclick=function(){code=$('code').value.trim();localStorage.setItem('bitgil-code',code);connect()};
$('nx').onclick=function(){ if(st&&st.next&&confirm('"'+st.next+'"(으)로 진행할까요?\\n실제 조명이 바로 바뀝니다.'))cmd('c=next') };
$('def').onclick=function(){cmd('c=default')};
$('bo').onclick=function(){cmd('c=blackout&on='+(st&&st.blackout?0:1))};
if(code)connect();else show(true);
</script></body></html>`
