/* 이성주: 203호의 전설 — zero-dependency playable browser RPG */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d', { alpha: false });
  const W = 800, H = 450;
  const photos = { seongju: 'assets/seongju.webp', guest: 'assets/guest.webp' };
  const img = { seongju: new Image(), guest: new Image() };
  for (const k of Object.keys(img)) img[k].src = photos[k];
  let G, keys = new Set(), held = new Set(), last = 0, anim = 0, toastTimer = 0, audioCtx = null, sound = true;
  const bgmAudio = $('bgmAudio');
  let bgmEnabled = true, bgmVolume = 0.15;
  bgmAudio.volume = bgmVolume;
  function updateBgmUI(){
    $('bgmBtn').textContent=bgmEnabled?'♫ BGM ON':'♫ BGM OFF';
    $('titleBgmBtn').textContent=bgmEnabled?'♫ 배경음악 켜짐':'♫ 배경음악 꺼짐';
    $('bgmBtn').setAttribute('aria-pressed',String(bgmEnabled));
    $('titleBgmBtn').setAttribute('aria-pressed',String(bgmEnabled));
    $('bgmVolume').value=$('titleBgmVolume').value=String(Math.round(bgmVolume*100));
    $('bgmVolumeText').textContent=$('titleBgmVolumeText').textContent=Math.round(bgmVolume*100)+'%';
  }
  function startBgm(){
    if(!bgmEnabled || bgmVolume<=0)return;
    bgmAudio.volume=bgmVolume;
    if(!bgmAudio.paused)return;
    const result=bgmAudio.play(); // user explicitly clicked Start / BGM ON
    if(result && result.catch)result.catch(()=>{ /* autoplay blocked until next gesture */ });
  }
  function toggleBgm(){
    bgmEnabled=!bgmEnabled;
    if(bgmEnabled)startBgm();
    else bgmAudio.pause();
    updateBgmUI();
  }
  function setBgmVolume(value){
    bgmVolume=Math.max(0,Math.min(100,Number(value)||0))/100;
    bgmAudio.volume=bgmVolume;
    if(bgmVolume===0)bgmAudio.pause();
    else if(bgmEnabled && !$('gameScreen').classList.contains('hidden') && bgmAudio.paused)startBgm();
    updateBgmUI();
  }
  let minigame = null;
  let touchMove = null;
  let tapGoal = null;
  const evidenceLabels = {
    poster: '여관 간판에서 이상한 예감을 감지함',
    brave: '성주의 자신감 넘치는 증언 확보',
    noise: '203호에서 들린 수상한 삐걱 소리',
    vending: '복도 자판기에서 생존 아이템 확보'
  };
  const sceneNames = { street: ['CHAPTER 01', '낡은 여관 앞'], hall: ['CHAPTER 02','공포의 2층 복도'], chase: ['CHAPTER 04','도망쳐! 최후의 탈출'] };
  const rain = Array.from({length: 54}, (_,i) => ({x:(i*173+57)%800, y:(i*67+3)%450, s:1+(i%4), speed:70+(i*13)%95}));

  function initial() { return {
    scene: 'street', phase:'intro', player:{x:560,y:357,dir:1,moving:false},
    evidence:[], items:[], mental:100, fear:0, party:3, route:'listen', listenScore:0,
    cutscene:null, dialog:null, choice:false, chaseTime:20, chaser:{x:755,y:310}, hits:0,
    ended:false, endingId:null, clock:0, freeze:0, talked:[], chaseText:'', introDone:false
  }; }
  G = initial();
  const safe = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
  const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function rect(x,y,w,h,c){ ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(Math.round(x),Math.round(y),w,h,r);ctx.fill();}
  function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function txt(text,x,y,size=14,color='#fff',align='center',bold=true){ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`${bold?900:500} ${size}px 'Pretendard','Noto Sans KR',sans-serif`;ctx.fillText(text,x,y);ctx.textAlign='left';}
  function ellipse(x,y,rx,ry,c){ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function glow(x,y,r,color){ const gr=ctx.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,color);gr.addColorStop(1,'#00000000');ctx.fillStyle=gr;ctx.fillRect(x-r,y-r,r*2,r*2); }

  function ensureAudio(){if (!sound) return null; try {audioCtx ??= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}catch{return null;}}
  function sfx(type='tick'){
    const ac=ensureAudio();if(!ac)return;
    const now=ac.currentTime;
    function osc(freq,end,dur=0.12,wave='square',v=.036,delay=0){ const o=ac.createOscillator(), gain=ac.createGain();o.type=wave;o.frequency.setValueAtTime(freq,now+delay);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+delay+dur);gain.gain.setValueAtTime(v,now+delay);gain.gain.exponentialRampToValueAtTime(.001,now+delay+dur);o.connect(gain);gain.connect(ac.destination);o.start(now+delay);o.stop(now+delay+dur+.01);}
    if(type==='tick')osc(560,360,.08,'square',.018);
    if(type==='step')osc(75,45,.025,'triangle',.006);
    if(type==='alert'){osc(520,110,.5,'sawtooth',.07);osc(720,210,.55,'sawtooth',.03,.07);}
    if(type==='squeak'){osc(180,620,.28,'sawtooth',.035);osc(610,145,.4,'triangle',.05,.32);}
    if(type==='victory'){[440,550,660,880].forEach((f,i)=>osc(f,f*.96,.16,'triangle',.08,i*.14));}
    if(type==='fail'){[330,265,200].forEach((f,i)=>osc(f,f*.63,.25,'sawtooth',.055,i*.19));}
  }
  function toast(message,ms=2200){let el=$('eventToast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),ms);}
  function record(id){if(G.evidence.includes(id))return;G.evidence.push(id);updateHUD();toast('📌 목격 기록 발견! '+evidenceLabels[id],2800);sfx('tick');}
  function item(id){if(G.items.includes(id))return;G.items.push(id);updateHUD();toast('🎒 아이템 획득: '+id);}
  function mind(delta,fear=0){G.mental=clamp(G.mental+delta,0,100);G.fear=clamp(G.fear+fear,0,100);updateHUD();}
  function updateHUD(){
    const sn=sceneNames[G.scene]||sceneNames.hall;$('chapterId').textContent=sn[0];$('sceneName').textContent=sn[1];
    $('mentalValue').textContent=G.mental+' / 100';$('mentalFill').style.width=G.mental+'%';
    $('fearValue').textContent=G.fear+'%';$('fearFill').style.width=G.fear+'%';
    $('partyValue').textContent=G.party+'명';$('clueValue').textContent=G.evidence.length+' / 4';
    $('inventory').innerHTML=G.items.length?G.items.map(x=>`<span class="item-chip">${safe(x)}</span>`).join(''):'<span class="inventory-empty">가방이 텅 비어 있다…</span>';
    $('evidenceList').innerHTML=G.evidence.length?G.evidence.map(x=>`<div class="evidence"><span class="check">✓</span><span>${safe(evidenceLabels[x])}</span></div>`).join(''):'<div class="evidence-empty">아직 확보한 목격담이 없습니다.</div>';
    const text={street:'여관 입구까지 걸어가서 조사하세요.',arrival:'친구와 대화하거나 203호 문을 조사하세요.',closed:'203호 문 앞으로 가서 E로 조사하세요.',afterListen:'이제 203호 문을 다시 조사하세요.',chase:'← 왼쪽 출구로 질주하세요!'};
    $('questText').textContent=text[G.scene==='street'?'street':G.scene==='chase'?'chase':G.phase]||'203호의 비밀을 밝혀라!';
  }
  function updateSound(){ $('soundBtn').textContent=sound?'♪ ON':'♪ OFF';$('titleSoundBtn').textContent=sound?'♪ 효과음 켜짐':'♪ 효과음 꺼짐';}
  function hideAll(){for(const name of ['dialogueLayer','choiceLayer','miniLayer','cinemaLayer','endingLayer']) $(name).classList.add('hidden');}
  function locked(){return !!(G.dialog||G.choice||minigame||G.cutscene||G.ended);}

  function showSequence(lines,done=()=>{}){
    G.dialog={lines,index:0,done};G.choice=false;$('choiceLayer').classList.add('hidden');renderDialog();
  }
  function renderDialog(){const d=G.dialog;if(!d)return;const L=d.lines[d.index];
    $('dialogSpeaker').textContent=L[0]||'???';$('dialogText').textContent=L[1]||'';
    const portrait=L[2]||null,frame=document.querySelector('.portrait-frame');frame.classList.toggle('nopic',!portrait);
    if(portrait){$('dialogPortrait').src=photos[portrait];$('dialogPortrait').alt=L[0];}
    $('dialogueLayer').classList.remove('hidden');sfx(d.index===0?'tick':'step');
  }
  function nextDialog(){if(!G.dialog)return;sfx('tick');G.dialog.index++;if(G.dialog.index<G.dialog.lines.length)renderDialog();else{const done=G.dialog.done;G.dialog=null;$('dialogueLayer').classList.add('hidden');done();updateHUD();}}
  function choices(title,desc,items,eyebrow='MAKE YOUR CHOICE'){
    G.choice=true;$('dialogueLayer').classList.add('hidden');
    const el=$('choiceLayer');el.innerHTML=`<div class="choice-card"><div class="choice-eyebrow">${safe(eyebrow)}</div><h2 class="choice-title">${safe(title)}</h2><p class="choice-desc">${safe(desc)}</p><div class="choice-options">${items.map((b,i)=>`<button type="button" class="choice-btn" data-choice="${i}"><span><span class="choice-num">0${i+1}</span> &nbsp; ${safe(b.text)}</span><em>${safe(b.hint||'')}</em></button>`).join('')}</div></div>`;
    el.classList.remove('hidden');el.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>{
      const n=Number(btn.dataset.choice);G.choice=false;el.classList.add('hidden');sfx('tick');items[n].action();updateHUD();
    }));
  }
  function cutscene(kind,continueFn){G.cutscene=continueFn;const layer=$('cinemaLayer');
    if(kind==='return'){
      layer.innerHTML=`<div class="cinema-bg"></div><div class="cinema-stars"></div><div class="cinema-inner"><div class="cinema-top">CHAPTER 03 · HERO RETURNS</div><img class="cinema-portrait" src="${photos.seongju}" alt="이성주" /><div class="cinema-title">그가… 돌아왔다.</div><div class="cinema-sub">당황해 도망친 친구들.<br>그런데 얼굴이 새빨개진 성주만 당당했다.</div><div class="cinema-small">LEGENDARY SURVIVOR UNLOCKED</div><button id="cinemaAdvance" class="cinema-continue">▶ 다음 장면</button></div>`;
      sfx('victory');
    } else {
      layer.innerHTML=`<div class="cinema-bg"></div><div class="cinema-stars"></div><div class="cinema-inner"><div class="cinema-top">!!! FINAL ENCOUNTER !!!</div><div class="versus"><img src="${photos.seongju}" alt="이성주" /><b>VS</b><img src="${photos.guest}" alt="203호의 손님" /></div><div class="cinema-title">너네는 왜 안 했니?</div><div class="cinema-sub">복도가 얼어붙었다.<br>친구 전원 정신력 -99</div><button id="cinemaAdvance" class="cinema-continue">▶ 죽기 살기로 도망친다</button></div>`;
      sfx('alert');
    }
    layer.classList.remove('hidden');$('cinemaAdvance').addEventListener('click',finishCutscene);
  }
  function finishCutscene(){if(!G.cutscene)return;const fn=G.cutscene;G.cutscene=null;$('cinemaLayer').classList.add('hidden');sfx('tick');fn();}

  function start(){G=initial();keys.clear();held.clear();tapGoal=null;minigame=null;hideAll();$('titleScreen').classList.add('hidden');$('gameScreen').classList.remove('hidden');$('miniLayer').innerHTML='';$('endingLayer').innerHTML='';$('cinemaLayer').innerHTML='';$('choiceLayer').innerHTML='';$('interactionPrompt').classList.add('hidden');$('eventToast').classList.add('hidden');
    updateHUD();ensureAudio();startBgm();
    showSequence([
      ['내레이션','20살. 무엇이든 가능하다고 믿었던 어느 밤.'],
      ['내레이션','친구들은 낡은 여관 앞에 모였다.\n…이게 훗날 전설의 시작일 줄은 아무도 몰랐다.'],
      ['이성주','야, 왜 다들 표정이 그래? ㅋㅋ', 'seongju'],
      ['친구','느낌이 좀 쎄한데… 일단 가 보자.']
    ],()=>{G.phase='arrival';G.introDone=true;updateHUD();toast('🎮 이동: WASD / 방향키 · 조사: E / SPACE',3600);});
    $('viewport').focus({preventScroll:true});
  }
  function goHall(){tapGoal=null;G.scene='hall';G.phase='arrival';G.player.x=85;G.player.y=322;G.player.dir=1;G.party=3;
    mind(-5,12);updateHUD();showSequence([
      ['내레이션','2층 복도. 희미한 형광등 아래 방문 네 개가 보인다.'],
      ['친구 A','야 근데 여기… 왜 이렇게 조용해?'],
      ['친구 B','이럴 땐 무조건 203호가 수상하더라.']
    ],()=>toast('🔎 조사 가능한 사물 근처에서 E를 누르세요.'));
  }

  function on203(){
    if(G.phase==='arrival'){
      mind(-15,30);G.party=0;G.phase='closed';G.player.y=294;updateHUD();sfx('alert');
      showSequence([
        ['내레이션','덜컥. 203호의 문이 열렸다.'],
        ['203호의 손님','어머, 어서 들어와~', 'guest'],
        ['친구 A','잠깐. 우리가 상상한 분위기랑 좀 다른데?!'],
        ['친구 B','…야. 나 갑자기 집에 급한 일이 생겼어!!'],
        ['내레이션','친구들은 순식간에 복도로 뛰쳐나왔다.\n그런데 단 한 명만 나오지 않았다.'],
        ['친구 A','어라? 성주는?'],
        ['이성주','너희 먼저 가. 난 괜찮아.', 'seongju'],
        ['내레이션','철컥. 203호의 문이 굳게 닫혔다.']
      ],()=>{G.player.x=389;G.player.y=305;toast('🚪 203호에서 수상한 소리가 들린다…',3400);});
    } else if(G.phase==='closed'){
      choices('203호. 닫힌 문 앞','안에서 희미한 소리가 들린다. 친구들은 겁에 질렸다. 어떻게 할까?',[
        {text:'문에 귀를 대고 들어본다',hint:'미니게임',action:startListening},
        {text:'살짝 노크해 본다',hint:'용기 +1',action:()=>{G.route='knock';mind(-19,20);showSequence([
          ['친구','성주야!!! 살아 있냐?!'],['이성주','왜? 무슨 일인데?', 'seongju'],['친구','…아무 일도 아니다. 너 진짜 대단하다.']
        ],()=>reveal());}},
        {text:'절대 뒤돌아보지 않고 도망친다',hint:'겁쟁이 엔딩',action:()=>end('coward')},
        {text:'일단 다른 방을 둘러본다',hint:'뒤로 가기',action:()=>toast('잠깐. 아직 확인하지 못한 것이 있다…')}
      ],'ROOM 203 / INVESTIGATE');
    } else if(G.phase==='afterListen'){reveal();}
  }

  function startListening(){G.route='listen';G.evidence.includes('noise')||record('noise');
    minigame={round:0,hits:0,results:[],phase:0,time:0,feedback:''};
    $('miniLayer').innerHTML=`<div class="mini-card"><div class="choice-eyebrow">SECRET MINI GAME / EAR TO THE DOOR</div><h2>👂 203호 청취 작전</h2><p>움직이는 표시가 <b style="color:#b6f2a0">초록색 구역</b>에 왔을 때 누르세요!<br>3번의 이상한 소리를 포착해야 합니다.</p><div class="mini-count" id="roundText">ROUND 1 / 3</div><div class="mini-meter"><div class="mini-success"></div><div id="miniNeedle" class="mini-needle"></div></div><div class="mini-ticks"><span>수상함</span><span>삐걱… 삐걱…</span><span>매우 수상함</span></div><button id="miniHit" class="mini-hit">⚡ 지금 듣기! (SPACE)</button><div class="mini-note" id="miniNote">귀를 대는 순간을 노려라…</div><div class="mini-scores" id="miniScores"><i></i><i></i><i></i></div></div>`;
    $('miniLayer').classList.remove('hidden');$('miniHit').addEventListener('click',hitMini);
  }
  function hitMini(){if(!minigame||minigame.feedback)return;const pos=(Math.sin(minigame.phase)+1)*50;const hit=pos>=39&&pos<=61;
    minigame.results.push(hit);minigame.hits+=Number(hit);minigame.round++;
    sfx('squeak');mind(hit?-5:-11,hit?5:12);
    const phrases=hit?['삐걱… 삐걱… 정체를 알 수 없다!','친구: "저게… 대체 무슨 소리야?!"','성주 목소리? "나 괜찮다니까!"']:['문에 머리를 쿵! 부딪혔다.','친구: "야 조용히 해!!"','문고리가 덜컥 움직였다.'];
    minigame.feedback=phrases[(minigame.round-1)%3];$('miniNote').textContent=minigame.feedback;
    document.querySelectorAll('#miniScores i').forEach((el,i)=>{el.className=i<minigame.results.length?(minigame.results[i]?'hit':'miss'):'';});
    $('miniHit').disabled=true;
    const current=minigame;
    setTimeout(()=>{if(minigame!==current)return;if(current.round>=3){const hits=current.hits;G.listenScore=hits;minigame=null;$('miniLayer').classList.add('hidden');mind(-10,10);G.phase='afterListen';showSequence([
      ['친구 A','내가 들은 거 맞지? 지금 그 소리…'],
      ['친구 B',hits>=2?'야 성주는 대체 안에서 뭘 하고 있는 거야?':'그만 듣자. 진짜 정신 나갈 것 같아.'],
      ['내레이션','그 순간, 203호 문고리가 천천히 돌아가기 시작했다.']
    ],()=>reveal());}else{current.feedback='';current.phase=0;current.time=0;$('roundText').textContent='ROUND '+(current.round+1)+' / 3';$('miniHit').disabled=false;$('miniNote').textContent='다음 소리가 다가온다…';}},900);
  }
  function reveal(){G.phase='reveal';G.party=2;mind(-7,10);updateHUD();cutscene('return',()=>{
    showSequence([
      ['친구 A','성주야!! 너 왜 이제 나와?!'],
      ['내레이션','그의 얼굴은 빨갛게 달아올라 있었다.'],
      ['이성주','뭐야. 다들 왜 이렇게 놀랐어?', 'seongju'],
      ['친구 B','…우린 오늘 아무것도 못 본 거다.'],
      ['내레이션','그때였다. 뒤에서 문 여는 소리가 들렸다.']
    ],()=>cutscene('boss',()=>{
      G.party=1;mind(-30,40);startChase();
    }));
  });
  }
  function startChase(){tapGoal=null;G.scene='chase';G.phase='chase';G.player.x=635;G.player.y=315;G.chaser.x=745;G.chaser.y=310;G.chaseTime=23;G.hits=0;G.freeze=0;G.mental=Math.max(20,G.mental);keys.clear();held.clear();updateHUD();toast('⚠️ 왼쪽 출구로 달려! 방향키 / WASD 이동!',3700);sfx('alert');}
  function escaped(){G.scene='hall';G.phase='afterChase';G.player.x=81;G.player.y=329;updateHUD();sfx('victory');
    showSequence([['내레이션','탕! 복도 끝 출구를 열고 모두 밖으로 튀어나왔다.'],['친구 A','하아… 하아… 대체 오늘 밤 뭐였냐…'],['친구 B','근데 성주야. 너는 어떻게 그렇게 태연할 수가 있어?']],()=>{
      choices('성주의 마지막 한마디','친구들의 시선이 성주에게 쏠린다. 이 밤을 어떻게 기억하게 할 것인가?',[
        {text:'"난 그냥 내 길을 갔을 뿐이야."',hint:'전설 엔딩',action:()=>end(G.listenScore===3?'secret':'legend')},
        {text:'"아무것도 묻지 마. 전부 잊자."',hint:'기억삭제 엔딩',action:()=>end('trauma')},
        {text:'"우리가 잃은 건 정신력뿐이야."',hint:'우정 엔딩',action:()=>end('friendship')},
        ...(G.items.includes('비타500')?[{text:'"이건… 내일 마셔야지."',hint:'히든 엔딩',action:()=>end('vending')}]:[])
      ],'FINAL DECISION / YOUR ENDING');
    });
  }
  const endings={
    coward:{rank:'F',title:'겁쟁이 생존자',ribbon:'ENDING 01 / THE COWARD',desc:'당신은 뒤도 돌아보지 않고 도망쳤다.\n그날 203호에서 무슨 일이 일어났는지는 영원한 미스터리.\n다만 친구들은 성주를 두고 왔다는 사실만큼은 잊지 못했다.',score:'000,203'},
    captured:{rank:'D',title:'복도에서 잡힌 자',ribbon:'ENDING 02 / CAUGHT',desc:'203호 손님에게 붙잡히고 말았다.\n"왜 이렇게 급하게 가?"라는 한마디를 듣는 순간,\n당신의 정신력은 마이너스가 되었다.',score:'002,030'},
    trauma:{rank:'C',title:'기억삭제 시도 실패',ribbon:'ENDING 03 / AMNESIA',desc:'전원 합의하에 오늘의 기억을 지우기로 했다.\n그러나 3일 뒤 밥을 먹던 친구가 뜬금없이 말했다.\n"야 근데… 성주는 왜 안 나왔냐?"\n전원 식사 중단.',score:'020,303'},
    friendship:{rank:'B',title:'살아남은 우정',ribbon:'ENDING 04 / FRIENDSHIP',desc:'그날의 사건을 겪고 친구들은 한층 단단해졌다.\n…는 무슨, 203호 이야기를 꺼내기만 하면\n단체 채팅방이 20분간 폭발한다.',score:'203,203'},
    legend:{rank:'S',title:'203호의 전설',ribbon:'TRUE ENDING / THE LEGEND',desc:'친구들은 도망쳤다.\n그러나 성주는 끝까지 침착했다.\n세월이 흘러도 남은 건 단 하나의 질문.\n"너네는 왜 안 했니?"\n그날 이후, 한 남자는 203호의 전설이 되었다.',score:'999,203'},
    vending:{rank:'SS',title:'비타500의 사나이',ribbon:'SECRET ENDING / VENDING MACHINE',desc:'다들 도망가던 그때, 혼자 비타500을 챙긴 사람.\n공포보다 중요한 건 내일 아침의 컨디션이었다.\n성주는 그 병을 높이 들었다.\n"이것이 진정한 생존이다."',score:'500,500'},
    secret:{rank:'SSS',title:'귀 밝은 전설의 목격자',ribbon:'HIDDEN TRUE ENDING / PERFECT',desc:'당신은 세 번의 청취를 완벽하게 성공했다.\n그러나 진실은 끝내 밝혀지지 않았다.\n203호는 신화가 되었고, 성주는 웃었다.\n친구들은 평생 그 웃음의 이유를 묻지 못했다.',score:'∞'}
  };
  function end(id){tapGoal=null;G.ended=true;G.endingId=id;G.dialog=null;G.choice=false;minigame=null;hideAll();$('eventToast').classList.add('hidden');clearTimeout(toastTimer);const e=endings[id]||endings.legend;sfx(['legend','vending','secret'].includes(id)?'victory':'fail');
    const el=$('endingLayer');el.innerHTML=`<div class="end-card"><div class="end-eyebrow">203호 사건 기록 · GAME CLEAR</div><h2>${safe(e.title)}</h2><span class="end-ribbon">${safe(e.ribbon)}</span><div class="end-photos"><img src="${photos.seongju}" alt="이성주" /><span>✦ 203 ✦</span><img src="${photos.guest}" alt="203호 손님" /></div><p class="end-desc">${safe(e.desc)}</p><div class="end-stats"><div><small>ENDING RANK</small><strong>${safe(e.rank)}</strong></div><div><small>전설 점수</small><strong>${safe(e.score)}</strong></div><div><small>청취 성공</small><strong>${G.listenScore} / 3</strong></div></div><div class="end-actions"><button id="endReplay">↻ 다시 플레이</button><button id="endShare" class="secondary">↗ 결과 공유</button><button id="endSave" class="secondary">↓ 인증서 저장</button></div><div class="end-caption">친구에게 공유해 보세요. · 허구의 블랙코미디 게임</div></div>`;
    el.classList.remove('hidden');$('interactionPrompt').classList.add('hidden');$('endReplay').onclick=start;$('endShare').onclick=()=>shareEnding(e);$('endSave').onclick=()=>saveCertificate(e);
    try{const past=JSON.parse(localStorage.getItem('room203_endings')||'[]');if(!past.includes(id))past.push(id);localStorage.setItem('room203_endings',JSON.stringify(past));}catch{}
  }
  async function shareEnding(e){const text=`🎮 이성주: 203호의 전설\n🏆 나의 엔딩: ${e.title} (RANK ${e.rank})\n전설 점수: ${e.score}\n너도 203호에서 살아남을 수 있을까?\n${location.href}`;
    try{if(navigator.share){await navigator.share({title:'이성주: 203호의 전설',text,url:location.href});return;}if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);toast('✅ 결과와 게임 주소를 복사했습니다!');return;}}
    catch(err){if(err.name==='AbortError')return;}
    const el=document.createElement('textarea');el.value=text;el.style.position='fixed';el.style.left='-9999px';document.body.append(el);el.select();const ok=document.execCommand('copy');el.remove();toast(ok?'✅ 공유할 문구를 복사했습니다!':'주소창의 링크를 복사해서 공유해주세요.');
  }
  function saveCertificate(e){const c=document.createElement('canvas');c.width=1200;c.height=630;const p=c.getContext('2d');const grad=p.createLinearGradient(0,0,1200,630);grad.addColorStop(0,'#38203b');grad.addColorStop(1,'#101529');p.fillStyle=grad;p.fillRect(0,0,1200,630);p.strokeStyle='#eab670';p.lineWidth=9;p.strokeRect(23,23,1154,584);p.strokeStyle='#a45465';p.lineWidth=2;p.strokeRect(40,40,1120,550);p.fillStyle='#f5ac98';p.font='bold 23px sans-serif';p.textAlign='center';p.fillText('203호 사건 기록 / OFFICIAL CERTIFICATE',600,90);p.fillStyle='#ffdc9a';p.font='900 64px sans-serif';p.fillText(e.title,600,175);
    if(img.seongju.complete&&img.seongju.naturalWidth) {p.save();p.beginPath();p.arc(470,305,98,0,Math.PI*2);p.clip();p.drawImage(img.seongju,370,195,200,225);p.restore();}
    if(img.guest.complete&&img.guest.naturalWidth){p.save();p.beginPath();p.arc(740,305,98,0,Math.PI*2);p.clip();p.drawImage(img.guest,635,200,210,215);p.restore();}
    p.fillStyle='#fff1d1';p.font='900 36px monospace';p.fillText('VS',605,312);p.font='800 36px monospace';p.fillText('RANK '+e.rank+'  ·  SCORE '+e.score,600,470);p.font='bold 21px sans-serif';p.fillStyle='#c5adb6';p.fillText('이성주: 203호의 전설 — 친구들과 살아남아 보세요',600,538);
    const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='203호_생존인증서_'+e.rank+'.png';document.body.append(a);a.click();a.remove();toast('🏆 결과 인증서 이미지 저장 완료!');
  }

  const interactStreet=[
    {id:'entry',x:411,y:313,name:'여관으로 들어간다',fn:goHall},
    {id:'sign',x:214,y:307,name:'낡은 간판',fn:()=>{record('poster');showSequence([['내레이션','간판이 깜빡인다. 오래된 네온사인 아래 이상한 예감이 든다.'],['친구','거봐. 여기 뭐 있다니까.']]);}},
    {id:'seongju',x:308,y:355,name:'이성주와 대화',fn:()=>{record('brave');showSequence([['이성주','나만 믿어. 오늘은 뭔가 느낌이 좋아.', 'seongju'],['친구','쟤 저렇게 웃는 거 오히려 불안한데…']]);}},
    {id:'friend',x:660,y:358,name:'친구와 대화',fn:()=>showSequence([['친구','이상하게 오늘은 귀가 일찍 하고 싶다.'],['친구','이럴 때는 친구를 믿어야지. …아마도?']])}
  ];
  function hallObjects(){return [
    {id:'door203',x:500,y:225,name:'203호 조사',fn:on203},
    {id:'friend1',x:200,y:315,name:'친구 A와 대화',fn:()=>showSequence(G.phase==='arrival'?[['친구 A','야 우리 몇 호 들어가는 거야?'],['친구 A','내 직감에 203호는 위험해.']]:[['친구 A','성주 진짜 안 나오는 거냐고!!'],['친구 A','저 문에 귀 대는 건 네가 해봐…']])},
    {id:'friend2',x:318,y:336,name:'친구 B와 대화',fn:()=>showSequence(G.phase==='arrival'?[['친구 B','여기 좀 낡았는데?'],['친구 B','큰일 없겠지…?']]:[['친구 B','이건 평생 비밀로 하자.'],['친구 B','하… 자꾸 이상한 소리 들리지 않냐?']])},
    {id:'vending',x:684,y:316,name:'수상한 자판기',fn:()=>{record('vending');if(!G.items.includes('비타500')){item('비타500');showSequence([['자판기','삑. 비타500 한 병이 나왔다.'],['친구','이 상황에 그걸 왜 뽑고 있는 건데?!']]);}else showSequence([['내레이션','자판기에는 더 이상 새로 살 게 없어 보인다.']]);}},
    {id:'door201',x:158,y:225,name:'201호 조사',fn:()=>{sfx('squeak');showSequence([['내레이션','201호에서는 코 고는 소리만 들린다.'],['친구','와… 여기도 만만치 않네.']]);}},
    {id:'door202',x:332,y:225,name:'202호 조사',fn:()=>{showSequence([['내레이션','202호 문에는 종이가 붙어 있다.'],['종이','"청소 중. 옆방에서 시끄러우면 전화하세요."']]);}},
    {id:'door204',x:672,y:225,name:'204호 조사',fn:()=>{mind(-3,4);showSequence([['내레이션','204호에선 오래된 라디오 소리가 새어 나온다.'],['라디오','"그날… 한 남자만 돌아오지 않았다…"'],['친구','아 미친! 이거 일부러 그러는 거냐!']]);}},
    {id:'exit',x:78,y:335,name:'복도 출구',fn:()=>{if(G.phase==='arrival'||G.phase==='closed')choices('도망칠까?','성주를 남겨 두고 정말 탈출할까?',[
      {text:'그래. 나는 먼저 살겠다.',hint:'도망자 엔딩',action:()=>end('coward')},
      {text:'아직 성주를 두고 갈 순 없어.',hint:'계속 탐색',action:()=>toast('마음을 굳게 먹고 돌아섰다.')}
    ]);else toast('이야기가 아직 끝나지 않았다…');}}
  ];}
  function nearby(){if(G.scene==='chase')return null;const list=G.scene==='street'?interactStreet:hallObjects();const possible=list.map(o=>({...o,d:dist(o,G.player)})).filter(x=>x.d<76).sort((a,b)=>a.d-b.d);return possible[0]||null;}
  function interact(){if(G.ended)return;if(G.dialog){nextDialog();return;}if(G.cutscene){finishCutscene();return;}if(G.choice)return;if(minigame){hitMini();return;}const n=nearby();if(n){sfx('tick');n.fn();}else toast('가까이 다가가서 조사하세요.',1100);}

  function drawPlayer(x,y,kind='player',walk=0,dir=1){ctx.save();ctx.translate(Math.round(x),Math.round(y));const bob=walk?Math.sin(anim*12)*1.7:0;
    ellipse(0,7,17,6,'#0709177b');const shirt=kind==='seongju'?'#b76058':kind==='friend'?'#7b85a8':kind==='boss'?'#a15c87':'#6f96ad';
    const pants=kind==='boss'?'#472d5b':'#313348';rect(-8,1+bob,6,11,pants);rect(3,1-bob,6,11,pants);
    rect(-11,-18+bob,22,23,shirt);rect(-14,-16+bob,5,16,shirt);rect(9,-16+bob,5,16,shirt);
    rect(-10,-29+bob,20,15,'#f1bb94');rect(-12,-33+bob,24,8,kind==='boss'?'#29232d':'#342b2e');
    rect(-7,-19+bob,5,2,'#241d2b');rect(2,-19+bob,5,2,'#241d2b');
    if(kind==='seongju'){line(-6,-14+bob,5,-14+bob,'#783c3f',2);rect(-11,-36+bob,22,7,'#251b26');}
    if(kind==='boss'){rect(-11,-36+bob,22,9,'#342032');rect(-15,-32+bob,5,13,'#342032');rect(11,-32+bob,5,13,'#342032');}
    if(kind==='player'){rect(-11,-18+bob,22,4,'#a7dbcd');rect(dir===1?7:-11,-15+bob,4,9,'#e4b488');}
    ctx.restore();}
  function drawNPCFace(x,y,who){const im=img[who];if(!im.complete||!im.naturalWidth)return;ctx.save();ctx.fillStyle='#f4d6ac';ctx.fillRect(x-24,y-45,48,47);ctx.drawImage(im,x-22,y-43,44,43);ctx.restore();}
  function bubble(x,y,text){ctx.font='800 13px monospace';const ww=Math.max(31,ctx.measureText(text).width+18);round(x-ww/2,y-65,ww,24,5,'#fbda9a');txt(text,x,y-48,13,'#36263a');ctx.fillStyle='#fbda9a';ctx.beginPath();ctx.moveTo(x-5,y-41);ctx.lineTo(x+5,y-41);ctx.lineTo(x,y-35);ctx.fill();}
  function renderStreet(dt){const sky=ctx.createLinearGradient(0,0,0,430);sky.addColorStop(0,'#13132e');sky.addColorStop(.48,'#3b2749');sky.addColorStop(1,'#552638');ctx.fillStyle=sky;ctx.fillRect(0,0,800,450);
    glow(690,115,180,'#d180a52c');ellipse(665,81,30,30,'#f7d6d4');ellipse(675,70,30,30,'#463353');
    for(let i=0;i<20;i++){const sx=(i*181+25)%800,sy=(i*37+17)%146;rect(sx,sy,2,2,'#f6d7a177');}
    rect(0,206,145,160,'#1d2233');rect(670,178,130,196,'#1a2032');for(let i=0;i<9;i++){rect(8+i*81,225+(i%3)*16,24,31,'#171728');}
    rect(112,80,583,263,'#17182c');rect(130,100,544,235,'#383044');rect(135,107,532,225,'#403248');
    for(let y=110;y<322;y+=17){for(let x=139;x<663;x+=44){line(x,y,x+23,y,'#57405553',1);}}
    rect(148,132,156,123,'#18162b');rect(165,147,125,90,'#29223b');rect(165,147,125,4,'#ba7190');txt('별빛 여관',228,198,23,'#ff9b9f');txt('24H   MOTEL',226,226,12,'#efceac');
    rect(350,143,127,193,'#201827');rect(356,147,115,184,'#302336');rect(363,213,101,120,'#15121c');rect(367,217,93,112,'#2c273e');line(417,215,417,334,'#564659',4);ellipse(443,273,4,4,'#ffce78');
    glow(415,181,100,'#ffb75b55');rect(370,162,89,36,'#54252c');rect(376,168,77,24,'#171324');txt('203',415,188,20,'#ffd06d');
    rect(499,150,139,107,'#171728');rect(507,158,123,87,'#39354e');for(let y=164;y<241;y+=27){line(508,y,628,y,'#ad85ad',2);}line(570,159,570,245,'#ad85ad',3);
    rect(0,343,800,107,'#292334');rect(0,354,800,8,'#4b3444');for(let x=0;x<800;x+=75)rect(x+(anim*12%75),413,45,3,'#9c83906a');
    rect(73,286,16,67,'#362c37');glow(83,281,65,'#ffba6c50');round(65,264,35,16,5,'#fcb464');
    rect(638,293,45,61,'#3d233e');rect(643,299,35,45,'#211a30');txt('음료',660,315,12,'#ffb5a6');
    // Ambient rain: independent of world clock, harmless.
    for(let i=0;i<rain.length;i++){const r=rain[i];line(r.x,(r.y+anim*r.speed)%450,r.x-2,(r.y+anim*r.speed)%450+r.s*3,'#c7b9f32a');}
    drawPlayer(308,354,'seongju',0);bubble(308,352,'ㅎ ㅎ');drawPlayer(660,357,'friend',0);
    drawPlayer(G.player.x,G.player.y,'player',G.player.moving,G.player.dir);
    txt('서늘한 밤…',25,31,13,'#edb8d9','left');
  }
  function door(x,num,glowing=false){rect(x-40,124,80,107,'#181521');rect(x-34,132,68,99,'#4d334d');rect(x-29,137,58,93,'#33243a');rect(x-24,143,48,81,'#392944');rect(x-21,149,42,69,glowing?'#4b253d':'#352b41');rect(x-2,151,2,69,'#251a30');ellipse(x+14,193,3,3,'#e1a957');
    rect(x-25,116,50,24,glowing?'#b95955':'#403347');rect(x-23,118,46,20,glowing?'#6b282e':'#1e172a');
    if(glowing)glow(x,122,50,'#ff7a4d47');txt(String(num),x,134,13,glowing?'#ffd08a':'#c4afc2');
  }
  function renderHall(){rect(0,0,800,450,'#0f1424');rect(0,0,800,123,'#25223a');
    for(let x=0;x<800;x+=44){rect(x,0,2,116,'#37283e');rect(x+13,37,21,1,'#59405c38');}
    rect(25,75,750,164,'#34293d');rect(35,89,730,149,'#453247');rect(35,231,730,159,'#554053');
    for(let y=236;y<393;y+=32){rect(35,y,730,1,'#b78d8261');for(let x=35;x<765;x+=62)rect(x+(y%3)*21,y,1,32,'#1e1f3666');}
    rect(0,385,800,65,'#231d32');rect(0,390,800,5,'#716078');rect(39,233,725,5,'#a17c855b');
    for(let i=0;i<4;i++){const x=97+i*193;rect(x-3,71,6,32,'#c0ad9e');glow(x,98,51,'#ffa44a30');ellipse(x,102,10,8,'#f9b77a');}
    door(158,201,false);door(332,202,false);door(500,203,G.phase!=='arrival');door(672,204,false);
    // room 203 corridor marks, eerie glow
    glow(500,230,110,'#df4f5a20');rect(476,239,47,2,'#ffa06045');
    // emergency EXIT left
    rect(24,257,76,31,'#24514c');txt('EXIT ←',63,278,17,'#b9ffcd');
    // vending machine
    rect(650,274,75,98,'#241e2a');rect(655,273,65,94,'#4e344f');rect(660,280,55,49,'#282136');rect(665,285,45,29,'#627b8b');txt('비타500',687,305,12,'#fff2bd');rect(666,333,43,18,'#271a27');rect(668,357,40,5,'#10111d');
    // the friends shift when first open reveals
    drawPlayer(200,315,'friend',Math.sin(anim*3)>.8);drawPlayer(318,336,'friend',Math.cos(anim*2)>.85,-1);
    if(G.phase==='closed'||G.phase==='afterListen'){
      txt('…삐걱?',500,244,12,'#ffbbb9');
      if(Math.sin(anim*4)>.95){glow(500,184,95,'#fd6e8955');}
      bubble(200,315,'!!!');
    }
    drawPlayer(G.player.x,G.player.y,'player',G.player.moving,G.player.dir);
    txt('2F  ·  20:XX',754,35,14,'#b9aabd','right');
  }
  function renderChase(){renderHall();rect(0,0,800,450,'#ff265b16');glow(G.chaser.x,G.chaser.y,120,'#ff375a40');drawPlayer(G.chaser.x,G.chaser.y,'boss',1,-1);if(Math.sin(anim*9)>.78)bubble(G.chaser.x,G.chaser.y,'얘들아~');
    round(230,10,340,34,7,'#200b21dd');txt('⚠ 탈출까지 왼쪽으로!  '+Math.ceil(G.chaseTime)+'초',400,33,16,'#ffe4cf');
    if(G.freeze>0)rect(0,0,800,450,'#ff3d4a17');
  }
  function drawScene(){ctx.imageSmoothingEnabled=false;if(G.scene==='street')renderStreet();else if(G.scene==='hall')renderHall();else if(G.scene==='chase')renderChase();}
  function gameTick(now){const dt=clamp((now-last)/1000,0,.05);last=now;anim+=dt;if(!G.ended){
    let dx=0,dy=0;
    if(!locked()){
      if(keys.has('ArrowLeft')||keys.has('KeyA')||held.has('left'))dx-=1;
      if(keys.has('ArrowRight')||keys.has('KeyD')||held.has('right'))dx+=1;
      if(keys.has('ArrowUp')||keys.has('KeyW')||held.has('up'))dy-=1;
      if(keys.has('ArrowDown')||keys.has('KeyS')||held.has('down'))dy+=1;
      // On phones the player may simply tap the scene. Buttons/keyboard always override.
      if((dx||dy) && tapGoal)tapGoal=null;
      if(!dx&&!dy&&tapGoal){
        if(tapGoal.scene!==G.scene){tapGoal=null;}
        else {
          const deltaX=tapGoal.x-G.player.x,deltaY=tapGoal.y-G.player.y;
          if(Math.hypot(deltaX,deltaY)>4){dx=deltaX;dy=deltaY;}
          else {const fn=tapGoal.action;tapGoal=null;if(fn)fn();}
        }
      }
      const m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;G.player.moving=!!(dx||dy);
      if(dx)G.player.dir=dx<0?-1:1;
      const speed=G.scene==='chase'?(G.freeze>0?80:205):175;
      G.player.x=clamp(G.player.x+dx*dt*speed,G.scene==='street'?52:50,750);
      G.player.y=clamp(G.player.y+dy*dt*speed,G.scene==='street'?283:245,G.scene==='street'?395:375);
      if(tapGoal && !locked()){
        const close=Math.hypot(G.player.x-tapGoal.x,G.player.y-tapGoal.y)<(tapGoal.action?53:8);
        if(close){const fn=tapGoal.action;tapGoal=null;if(fn)fn();}
      }
    }else G.player.moving=false;
    if(G.scene==='chase'&&!locked()){
      G.chaseTime=Math.max(0,G.chaseTime-dt);G.freeze=Math.max(0,G.freeze-dt);
      const a=Math.atan2(G.player.y-G.chaser.y,G.player.x-G.chaser.x);
      G.chaser.x=clamp(G.chaser.x+Math.cos(a)*dt*124,45,766);
      G.chaser.y=clamp(G.chaser.y+Math.sin(a)*dt*124,255,375);
      if(dist(G.player,G.chaser)<32&&G.freeze===0){G.hits++;G.freeze=1.7;mind(-20,8);sfx('alert');toast('💥 잡혔다! 정신력 -20',1400);G.chaser.x=Math.min(G.chaser.x+85,766);if(G.hits>=3||G.mental===0){end('captured');}}
      if(G.scene==='chase'&&G.player.x<87){escaped();}
      else if(G.scene==='chase'&&G.chaseTime<=0){end('captured');}
    }
    if(minigame){minigame.time+=dt;minigame.phase+=dt*3.12;if(!minigame.feedback){const meter=$('miniNeedle');if(meter)meter.style.left=((Math.sin(minigame.phase)+1)*50).toFixed(1)+'%';}}
    if(G.scene!=='chase'&&!locked()){
      const n=nearby();$('interactionPrompt').classList.toggle('hidden',!n);
      if(n)$('interactionPrompt').innerHTML=`E <span>${safe(n.name)}</span>`;
    }else $('interactionPrompt').classList.add('hidden');
    $('coordsLabel').textContent='X: '+Math.round(G.player.x)+' · Y: '+Math.round(G.player.y);
  }
  drawScene();requestAnimationFrame(gameTick);}
  document.addEventListener('keydown',ev=>{
    const movement=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyW','KeyA','KeyS','KeyD'];
    if(movement.includes(ev.code)&&!$('gameScreen').classList.contains('hidden'))ev.preventDefault();
    keys.add(ev.code);
    if(ev.repeat&&['Space','KeyE','Enter'].includes(ev.code))return;
    if(ev.code==='KeyE'||ev.code==='Space'){
      if(G.choice){const sel=$('choiceLayer').querySelector('.choice-btn');if(sel)sel.click();}
      else interact();
    }
    if(ev.code==='Enter'&&G.dialog)nextDialog();
    if(G.choice&&/Digit[1-9]/.test(ev.code)){const idx=parseInt(ev.code.slice(-1),10)-1;const b=$('choiceLayer').querySelectorAll('.choice-btn')[idx];if(b)b.click();}
  });
  document.addEventListener('keyup',ev=>keys.delete(ev.code));window.addEventListener('blur',()=>{keys.clear();held.clear();tapGoal=null;});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();held.clear();tapGoal=null;}});
  $('dialogNextBtn').addEventListener('click',nextDialog);
  $('startBtn').addEventListener('click',start);
  $('bgmBtn').addEventListener('click',toggleBgm);
  $('titleBgmBtn').addEventListener('click',toggleBgm);
  $('bgmVolume').addEventListener('input',ev=>setBgmVolume(ev.target.value));
  $('titleBgmVolume').addEventListener('input',ev=>setBgmVolume(ev.target.value));
  $('restartBtn').addEventListener('click',start);
  $('soundBtn').addEventListener('click',()=>{sound=!sound;updateSound();if(sound)sfx('tick');});
  $('titleSoundBtn').addEventListener('click',()=>{sound=!sound;updateSound();if(sound)sfx('tick');});
  $('mobileAction').addEventListener('click',()=>{if(G.choice){const b=$('choiceLayer').querySelector('.choice-btn');if(b)b.click();}else interact();});
  document.querySelectorAll('[data-dir]').forEach(btn=>{
    const d=btn.dataset.dir;
    btn.addEventListener('pointerdown',ev=>{ev.preventDefault();try{btn.setPointerCapture(ev.pointerId);}catch{}held.add(d);btn.classList.add('pressed');});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(type,()=>{held.delete(d);btn.classList.remove('pressed');});
  });
  // One finger tap: walk to tapped spot. Tap an object/door: approach and inspect it.
  // Pointer handling keeps touch input separate from the canvas overlays and UI buttons.
  canvas.addEventListener('pointerup',ev=>{
    if(locked() || G.scene==='chase' || $('gameScreen').classList.contains('hidden'))return;
    const r=canvas.getBoundingClientRect();
    const tx=clamp((ev.clientX-r.left)/r.width*W,52,750);
    const ty=clamp((ev.clientY-r.top)/r.height*H,G.scene==='street'?283:245,G.scene==='street'?395:375);
    const objects=G.scene==='street'?interactStreet:hallObjects();
    const hotspot=objects.map(o=>({o,d:dist(o,{x:tx,y:ty})})).sort((a,b)=>a.d-b.d)[0];
    if(hotspot&&hotspot.d<70){
      if(dist(hotspot.o,G.player)<68){tapGoal=null;hotspot.o.fn();}
      else tapGoal={x:clamp(hotspot.o.x,52,750),y:clamp(hotspot.o.y,G.scene==='street'?283:245,G.scene==='street'?395:375),action:hotspot.o.fn,scene:G.scene};
    }else tapGoal={x:tx,y:ty,action:null,scene:G.scene};
    if(ev.pointerType==='touch')ev.preventDefault();
  });
  updateBgmUI();updateSound();updateHUD();requestAnimationFrame(gameTick);
})();
