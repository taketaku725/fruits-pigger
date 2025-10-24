document.addEventListener("DOMContentLoaded", () => {
  // ===== デバッグモード =====
  const DEBUG_HITBOX = false; // ← trueで当たり判定を表示。リリース時はfalseに！

  // ===== DOM要素 =====
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreDisplay = document.getElementById("score");
  const timeDisplay = document.getElementById("time");
  const timeEffectEl = document.getElementById("timeEffect");
  const countdown = document.getElementById("countdown");

  const titleScreen = document.getElementById("titleScreen");
  const howToPlayScreen = document.getElementById("howToPlayScreen");
  const gameScreen = document.getElementById("gameScreen");
  const resultScreen = document.getElementById("resultScreen");
  const rankingScreen = document.getElementById("rankingScreen");

  const startButton = document.getElementById("startButton");
  const startGameFromHowTo = document.getElementById("startGameFromHowTo");
  const backToTitle = document.getElementById("backToTitle");
  const showRankingFromTitle = document.getElementById("showRankingFromTitle");
  const showRankingFromResult = document.getElementById("showRankingFromResult");
  const backToTitleFromRanking = document.getElementById("backToTitleFromRanking");
  const retryButton = document.getElementById("retryButton");

  const finalScore = document.getElementById("finalScore");
  const rankText = document.getElementById("rankText");
  const highScoreText = document.getElementById("highScoreText");
  const newRecordText = document.getElementById("newRecordText");
  const rankingList = document.getElementById("rankingList");

  // ===== 定数 =====
  const GOLD_INTERVAL = 15000; // 金リンゴ出現間隔（ms）
  const MAX_RANK_DISPLAY = 5;
  const MAX_SCORES_SAVE = 100;

  // ===== 状態変数 =====
  let basket = { x: 0, y: 0, w: 0, h: 0 };
  let fruits = [];
  let effects = [];
  let score = 0;
  let timeLeft = 30;
  let gameOver = false;
  let frozen = false;
  let freezeTimer = 0;
  let feverMode = false;
  let feverTimer = 0;
  let lastGoldSpawn = performance.now() - Math.random() * GOLD_INTERVAL;

  // ===== 画像 =====
  const imgApple = new Image(); imgApple.src = "images/apple.png";
  const imgBanana = new Image(); imgBanana.src = "images/banana.png";
  const imgStraw = new Image(); imgStraw.src = "images/strawberry.png";
  const imgGold = new Image(); imgGold.src = "images/goldapple.png";
  const imgBomb = new Image(); imgBomb.src = "images/bomb.png";
  const pigImg = new Image(); pigImg.src = "images/pig.png";

  // ===== 果物タイプ =====
  const fruitTypes = [
    { name:"apple", score:99999999, weight:1.0, speed:[3.0,4.2], hitScale:0.7, img:imgApple, bomb:false, gold:false },
    { name:"banana", score:2, weight:0.7, speed:[3.6,4.8], hitScale:0.7, img:imgBanana, bomb:false, gold:false },
    { name:"strawberry", score:3, weight:0.4, speed:[4.2,5.5], hitScale:0.7, img:imgStraw, bomb:false, gold:false },
    { name:"goldapple", score:1, weight:0.01, speed:[5.2,6.0], hitScale:0.7, img:imgGold, bomb:false, gold:true },
    { name:"bomb", score:-3, weight:0.3, speed:[3.2,4.2], hitScale:0.8, img:imgBomb, bomb:true, gold:false },
  ];

  // ===== 画面管理 =====
  function showScreen(name) {
    [titleScreen, howToPlayScreen, gameScreen, resultScreen, rankingScreen].forEach(s => s.classList.remove("active"));
    if (name === "title") titleScreen.classList.add("active");
    if (name === "howto") howToPlayScreen.classList.add("active");
    if (name === "game") gameScreen.classList.add("active");
    if (name === "result") resultScreen.classList.add("active");
    if (name === "ranking") rankingScreen.classList.add("active");
  }

  // ===== リサイズ =====
  function resizeCanvas() {
    const width = Math.min(window.innerWidth * 0.9, 520);
    const height = Math.min(window.innerHeight * 0.65, 640);
    canvas.width = width;
    canvas.height = height;
    basket.w = width * 0.18;
    basket.h = height * 0.08;
    basket.x = width / 2 - basket.w / 2;
    basket.y = height - basket.h - 10;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ===== 時間プラス演出 =====
  function showTimePlusEffect(amount) {
    timeEffectEl.textContent = `+${amount}s`;
    timeEffectEl.classList.add("active");
    setTimeout(() => {
      timeEffectEl.classList.remove("active");
      timeEffectEl.textContent = "";
    }, 800);
  }

  // ===== ヘルパー =====
  function randRange([a,b]) { return a + Math.random() * (b - a); }
  function createFruit(type) {
    return {
      type: type.name,
      x: Math.random() * (canvas.width - 40),
      y: -40 - Math.random() * 60,
      size: canvas.width * 0.08,
      speed: randRange(type.speed),
      score: type.score,
      bomb: !!type.bomb,
      gold: !!type.gold,
      img: type.img,
      hitScale: type.hitScale
    };
  }
  function chooseFruitTypeNormal() {
    const total = fruitTypes.reduce((a,t)=>a+t.weight,0);
    let r = Math.random() * total;
    for (const t of fruitTypes) { if ((r -= t.weight) <= 0) return t; }
    return fruitTypes[0];
  }
  function chooseFruitTypeFever() {
    const pool = fruitTypes.filter(f => !f.bomb && !f.gold);
    return pool[Math.floor(Math.random()*pool.length)];
  }

  // ===== リセット =====
  function resetGame() {
    fruits = [];
    effects = [];
    score = 0;
    timeLeft = 30;
    gameOver = false;
    frozen = false;
    freezeTimer = 0;
    feverMode = false;
    feverTimer = 0;
    lastGoldSpawn = performance.now() - Math.random() * GOLD_INTERVAL;
    scoreDisplay.textContent = "スコア: 0";
    timeDisplay.childNodes[0].textContent = "残り時間: 30 ";
    document.body.classList.remove("fever");
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  // ===== タイマー =====
  function startTimer() {
    const timer = setInterval(() => {
      if (gameOver) { clearInterval(timer); return; }
      timeLeft--;
      timeDisplay.childNodes[0].textContent = "残り時間: " + timeLeft + " ";
      if (timeLeft <= 0) { clearInterval(timer); endGame(); }
    }, 1000);
  }

  // ===== フィーバー =====
  function startFeverTime() {
    feverMode = true;
    feverTimer = 300;
    timeLeft += 5;
    document.body.classList.add("fever");
    showTimePlusEffect(5);
  }
  function updateFever() {
    if (!feverMode) return;
    feverTimer--;
    for (let i = 0; i < 3; i++) fruits.push(createFruit(chooseFruitTypeFever()));
    if (feverTimer <= 0) {
      feverMode = false;
      document.body.classList.remove("fever");
    }
  }

  // ===== メインループ =====
  function update() {
    if (gameOver) return;

    // 金リンゴ出現
    const now = performance.now();
    if (now - lastGoldSpawn >= GOLD_INTERVAL) {
      lastGoldSpawn = now;
      const goldType = fruitTypes.find(f => f.gold);
      if (goldType) fruits.push(createFruit(goldType));
    }

    if (!feverMode && Math.random() < 0.03) fruits.push(createFruit(chooseFruitTypeNormal()));
    updateFever();
    fruits.forEach(f => f.y += f.speed);

    // ====== 当たり判定チェック ======
    fruits = fruits.filter(f => {
      if (frozen) return f.y < canvas.height + f.size;

      const hitSize = f.size * f.hitScale;
      const hitX = f.x + (f.size - hitSize) / 2;
      const hitY = f.y + (f.size - hitSize) / 2;

      // 🍎 判定範囲を共通式化
      const hitTop = basket.y - basket.h * 0.35 + basket.h * 0.45;
      const hitBottom = basket.y + basket.h * 0.1 + basket.h * 0.45;
    
      const overlap =
        hitY + hitSize > hitTop &&
        hitY + hitSize < hitBottom &&
        hitX + hitSize / 2 > basket.x + basket.w * 0.2 &&
        hitX + hitSize / 2 < basket.x + basket.w * 0.8;

      if (overlap) {
        let color = "#ff8fa3", text = `+${f.score}`;
        if (f.bomb) {
          score = Math.max(0, score - 3);
          frozen = true; freezeTimer = 120;
          color = "#ff4b4b"; text = "−3";
        } else {
          score += f.score;
          if (f.gold) { startFeverTime(); color = "#ffcc33"; }
        }
        effects.push({x:basket.x+basket.w/2, y:basket.y-20, text, color, life:60});
        scoreDisplay.textContent = "スコア: " + score;
        return false;
      }
      return f.y < canvas.height + f.size;
    });

    if (frozen) { freezeTimer--; if (freezeTimer <= 0) frozen = false; }
    draw();
    if (!gameOver) requestAnimationFrame(update);
  }

  // ===== 描画 =====
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 🐷 ぶた（背景）
    let alpha = frozen ? 0.7 + 0.3 * Math.sin(Date.now()/80) : 1;
    ctx.globalAlpha = alpha;
    const pigHeight = basket.h * 3;
    ctx.drawImage(pigImg, basket.x, basket.y - (pigHeight - basket.h), basket.w, pigHeight);
    ctx.globalAlpha = 1;
    if (frozen) {
      ctx.font = "bold 22px 'Rounded Mplus 1c'";
      ctx.fillStyle = "#ff6fa8";
      ctx.textAlign = "center";
      ctx.fillText("💤", basket.x + basket.w / 2, basket.y - 30);
    }

    // 🐷 デバッグ：ぶたさん当たり判定（実際のロジックと完全一致）
    if (DEBUG_HITBOX) {
      const hitTop = basket.y - basket.h * 0.35 + basket.h * 0.45;
      const hitBottom = basket.y + basket.h * 0.1 + basket.h * 0.45;
      const hitH = hitBottom - hitTop;

      // 横方向は左右20%カット。判定は果物中心線基準なので矩形も同じ幅で。
      const hitLeft = basket.x + basket.w * 0.2;
      const hitRight = basket.x + basket.w * 0.8;
      const hitW = hitRight - hitLeft;

      ctx.strokeStyle = "rgba(0,100,255,0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(hitLeft, hitTop, hitW, hitH);
    }

    // 🍎 果物
    for (const f of fruits) {
      ctx.drawImage(f.img, f.x, f.y, f.size, f.size);
      if (DEBUG_HITBOX) {
        const hitSize = f.size * f.hitScale;
        const hitX = f.x + (f.size - hitSize) / 2;
        const hitY = f.y + (f.size - hitSize) / 2;
        ctx.strokeStyle = f.bomb ? "red" : (f.gold ? "gold" : "limegreen");
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hitX, hitY, hitSize, hitSize);
      }
    }

    // ✨ スコアエフェクト
    effects.forEach(e => {
      ctx.globalAlpha = e.life / 60;
      ctx.fillStyle = e.color;
      ctx.font = "bold 20px 'Rounded Mplus 1c'";
      ctx.textAlign = "center";
      ctx.fillText(e.text, e.x, e.y - (60 - e.life) * 0.5);
      ctx.globalAlpha = 1;
    });
    effects = effects.filter(e => --e.life > 0);
  }

  // ===== 終了処理 =====
  async function endGame() {
    gameOver = true;
    countdown.style.display = "block";
    countdown.textContent = "タイムアップ！";
    await new Promise(r => setTimeout(r, 1000));
    countdown.style.display = "none";
    saveScore(score);
    displayResult(score);
    showScreen("result");
  }

  // ===== スコア処理 =====
  function saveScore(s) {
    let scores = JSON.parse(localStorage.getItem("scores") || "[]");
    scores.push(s);
    scores.sort((a,b)=>b-a);
    scores = scores.slice(0, MAX_SCORES_SAVE);
    localStorage.setItem("scores", JSON.stringify(scores));
  }
  function displayResult(current) {
    const scores = JSON.parse(localStorage.getItem("scores") || "[]");
    const rank = scores.indexOf(current) + 1;
    const high = scores[0] || current;
    finalScore.textContent = `スコア: ${current}`;
    rankText.textContent = rank <= 100 ? `あなたは ${rank} 位です` : `あなたは圏外（${rank} 位）です`;
    highScoreText.textContent = `ハイスコア: ${high}`;
    newRecordText.textContent = current === high ? "🎉 ハイスコア更新！" : "";
  }
  function updateRanking() {
    const list = rankingList;
    list.innerHTML = "";
    const scores = JSON.parse(localStorage.getItem("scores") || "[]");
    const top = scores.slice(0, MAX_RANK_DISPLAY);
    if (top.length === 0) {
      const li = document.createElement("li");
      li.textContent = "まだ記録がありません";
      list.appendChild(li);
      return;
    }
    top.forEach((s,i)=>{
      const li=document.createElement("li");
      li.textContent=`${i+1}位　${s}点`;
      list.appendChild(li);
    });
  }

  // ===== 操作 =====
  // PCマウス操作
  function moveBasketByPointer(x) {
    if (!frozen && !gameOver) {
      basket.x = Math.max(0, Math.min(canvas.width - basket.w, x - basket.w / 2));
    }
  }

  // PC
  document.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    moveBasketByPointer(x);
  });

  // スマホ
  document.addEventListener("touchmove", e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    moveBasketByPointer(x);
  });

  // ===== カウントダウン =====
  async function runCountdown() {
    countdown.style.display = "block";
    countdown.textContent = "3"; await new Promise(r=>setTimeout(r,800));
    countdown.textContent = "2"; await new Promise(r=>setTimeout(r,800));
    countdown.textContent = "1"; await new Promise(r=>setTimeout(r,800));
    countdown.textContent = "スタート！"; await new Promise(r=>setTimeout(r,600));
    countdown.style.display = "none";
  }

  // ===== ボタン =====
  startButton.onclick = () => showScreen("howto");
  startGameFromHowTo.onclick = async () => {
    showScreen("game");
    resetGame();
    await runCountdown();
    startTimer();
    requestAnimationFrame(update);
  };
  retryButton.onclick = async () => {
    showScreen("game");
    resetGame();
    await runCountdown();
    startTimer();
    requestAnimationFrame(update);
  };
  backToTitle.onclick = () => showScreen("title");
  showRankingFromTitle.onclick = () => { updateRanking(); showScreen("ranking"); };
  showRankingFromResult.onclick = () => { updateRanking(); showScreen("ranking"); };
  backToTitleFromRanking.onclick = () => showScreen("title");
});
