// --- 全域變數 ---
let quizTable;       // 儲存從 CSV 載入的完整表格
let fullQuizPool = []; // 完整的題庫陣列 (30題)
let quiz = [];         // 本次測驗的題庫陣列 (4題隨機)
const NUM_QUESTIONS = 4; // 本次測驗的題數
let currentQuestionIndex = 0; // 目前題號
let score = 0;         // 總百分比分數
let correctCount = 0;  // 答對題數
let userAnswers = [];  // 儲存使用者答案 (亂序後的新字母)
let userChoiceIndex = -1; // 儲存使用者選擇的選項索引 (0, 1, 2, 3)
let showAnswer = false; // 是否顯示當前問題的答案
let gameState = 'START'; // 遊戲狀態: START, QUIZ, RESULT, ERROR

// --- 特效變數 / 設計參數 ---
let particles = [];     
let cursorParticles = []; 
let optionBoxes = [];   

// **響應式設計：使用比例來定位**
const BASE_WIDTH = 800; // 原始設計寬度
const BASE_HEIGHT = 600; // 原始設計高度
let scaleFactor = 1; // 實際縮放比例

// --------------------
// P5.js 核心函數
// --------------------

function preload() {
  quizTable = loadTable('questions.csv', 'csv', 'header');
}

function setup() {
  // 1. 創建畫布並進行初始縮放計算
  // 這裡先創建畫布，大小會在 windowResized 中重新設定
  createCanvas(BASE_WIDTH, BASE_HEIGHT); 
  windowResized(); // 首次執行縮放計算，適應初始視窗
  
  textFont('Helvetica Neue, Arial, sans-serif');
  colorMode(RGB, 255); 
  
  if (quizTable && quizTable.getRowCount() > 0) {
    // 1. 處理完整題庫
    for (let row of quizTable.rows) {
      let q = {
        question: row.get('question'),
        // 原始選項陣列
        options: [
          row.get('optionA'),
          row.get('optionB'),
          row.get('optionC'),
          row.get('optionD')
        ],
        // 原始答案字母 (A, B, C, D)
        originalAnswerLetter: row.get('answerLetter').trim() 
      };
      fullQuizPool.push(q);
    }
    
    // 2. 從完整題庫中選取本次測驗的 4 題
    quiz = getRandomQuestions(fullQuizPool, NUM_QUESTIONS);
    
    // 3. 對每題的選項進行亂序，並儲存新的答案結構
    for (let q of quiz) {
      processQuestionOptions(q);
    }
    
    userAnswers = new Array(quiz.length).fill(null);
  } else {
    console.error("錯誤：無法載入 questions.csv 或檔案為空。");
    gameState = 'ERROR';
  }
  
  for (let i = 0; i < 20; i++) {
    particles.push(new Particle(random(width), random(height), 'backgroundBubble'));
  }
}

// **新增：視窗大小改變時呼叫的函數**
function windowResized() {
  // 找出寬度或高度的最大縮放比例
  let scaleW = windowWidth / BASE_WIDTH;
  let scaleH = windowHeight / BASE_HEIGHT;
  
  // 取較小的比例，以確保內容完全顯示在視窗內
  scaleFactor = min(scaleW, scaleH);
  
  // 計算新的畫布尺寸 (確保不超出視窗範圍，且有微小的邊界)
  // 縮放 95% 留下一些空間
  let newW = floor(BASE_WIDTH * scaleFactor * 0.95); 
  let newH = floor(BASE_HEIGHT * scaleFactor * 0.95);
  
  resizeCanvas(newW, newH);
  
  // 將畫布居中，並設定絕對定位 (這需要搭配 CSS 讓 body 居中)
  let x = (windowWidth - width) / 2;
  let y = (windowHeight - height) / 2;
  select('canvas').position(x, y); 
}

function draw() {
  background(240, 243, 247); 
  cursor(ARROW); 
  
  // **套用比例縮放 (重要)**
  // 將所有繪圖座標從 BASE_WIDTH/BASE_HEIGHT 空間映射到實際的 width/height 空間
  push();
  let currentScale = width / BASE_WIDTH;
  scale(currentScale);

  switch (gameState) {
    case 'START':
      drawStartScreen();
      break;
    case 'QUIZ':
      drawQuizScreen();
      break;
    case 'RESULT':
      drawResultScreen();
      break;
    case 'ERROR':
      drawErrorScreen();
      break;
  }
  
  updateAndDrawEffects();
  pop(); // 恢復原始的繪圖設定，防止影響其他元素
}

function mousePressed() {
  // 將滑鼠座標反向縮放，以匹配 draw 函數中的繪圖座標
  let currentScale = width / BASE_WIDTH;
  let scaledMouseX = mouseX / currentScale;
  let scaledMouseY = mouseY / currentScale;
  
  // 原始的設計參數 (NEXT_BUTTON_Y 會在 drawQuizScreen 中計算，這裡使用一個接近的值用於結果頁)
  const RESULT_BUTTON_Y = 520; 

  if (gameState === 'START') {
    // 重新選題和亂序選項 (確保每次開始都是新的測驗)
    quiz = getRandomQuestions(fullQuizPool, NUM_QUESTIONS);
    for (let q of quiz) {
      processQuestionOptions(q);
    }
    restartQuiz(false); // 重置狀態但不重置粒子背景
    gameState = 'QUIZ';
    particles = []; 
    return;
  } 
  
  if (gameState === 'QUIZ') {
    let q = quiz[currentQuestionIndex];
    if (!q) return; 

    // **使用 scaledMouseX/Y 檢查點擊**
    for (let box of optionBoxes) {
      if (scaledMouseX > box.x && scaledMouseX < box.x + box.w && 
          scaledMouseY > box.y && scaledMouseY < box.y + box.h) {
        
        if (box.type === 'option' && !showAnswer) {
          
          const userAnswerLetter = box.letter; // 亂序後的選項字母 (A, B, C, D)
          const correctAnswerLetter = q.shuffledAnswerLetter; // 亂序後的正確答案字母
          
          if (userAnswerLetter === correctAnswerLetter) {
             correctCount++; 
          }
          
          userAnswers[currentQuestionIndex] = userAnswerLetter;
          userChoiceIndex = box.index;
          showAnswer = true; 
          
          // **粒子位置也需要縮放**
          for(let i = 0; i < 20; i++) {
             cursorParticles.push(new Particle(mouseX, mouseY, 'clickBurst'));
          }
        } 
        else if (box.type === 'nextButton' && showAnswer) {
          goToNextQuestion();
        }
        return; 
      }
    }
  } 
  
  if (gameState === 'RESULT') {
    // 檢查是否點擊了畫布的任何地方 (結果頁面)
    restartQuiz(true); // 重新開始並重設為開始畫面
  }
}

// --------------------
// 新增：隨機處理邏輯 (保持不變)
// --------------------

// Fisher-Yates (Knuth) shuffle algorithm 陣列亂序
function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;

  while (currentIndex !== 0) {
    randomIndex = floor(random(currentIndex));
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

// 從題庫中隨機抽取 N 題
function getRandomQuestions(pool, n) {
  // 複製一份題庫，避免修改原始題庫
  let poolCopy = [...pool]; 
  // 亂序題庫
  shuffleArray(poolCopy);
  // 取前 N 題
  return poolCopy.slice(0, n); 
}

// 處理單個問題的選項亂序
function processQuestionOptions(q) {
  // 原始答案在 options 陣列中的索引 (0, 1, 2, 3)
  const originalIndex = q.originalAnswerLetter.charCodeAt(0) - 'A'.charCodeAt(0);
  const correctAnswerText = q.options[originalIndex];
  
  // 建立選項物件陣列，包含選項文字和原始答案標記
  let optionObjects = q.options.map((text, index) => ({
    text: text,
    isCorrect: (index === originalIndex)
  }));

  // 亂序選項
  shuffleArray(optionObjects);

  // 更新問題物件，儲存亂序後的選項和答案
  q.shuffledOptions = optionObjects;
  
  // 找出亂序後正確答案的新位置 (A, B, C, D)
  let newCorrectIndex = optionObjects.findIndex(opt => opt.isCorrect);
  q.shuffledAnswerLetter = String.fromCharCode('A'.charCodeAt(0) + newCorrectIndex);
}

// --------------------
// 繪圖輔助函數 (狀態) (使用 BASE_WIDTH/BASE_HEIGHT 座標)
// --------------------
// 重新定義常量以匹配原始設計，但現在它們在 draw 函數的 scale() 作用域內

// **優化畫面分配：調整 Y 座標**
const QUESTION_TOP_Y = 120;  // 問題起始 Y 座標 (稍微下移)
const OPTIONS_START_Y = 250; // 選項起始 Y 座標 (明顯下移，拉大與問題距離)
const NEXT_BUTTON_Y = 470;   // 下一題按鈕 Y 座標 (從 520 上移到 470)


function drawStartScreen() {
  for (let p of particles) {
    p.update();
    p.show();
  }

  textAlign(CENTER, CENTER);
  noStroke();
  fill(50, 70, 100); 
  textSize(48);
  textStyle(BOLD);
  text("p5.js 互動測驗系統", BASE_WIDTH / 2, BASE_HEIGHT / 3);
  textStyle(NORMAL);
  
  fill(100, 120, 150);
  textSize(24);
  text(`本次測驗將隨機抽取 ${NUM_QUESTIONS} 題`, BASE_WIDTH / 2, BASE_HEIGHT / 2 + 30);
  text("點擊畫面開始測驗", BASE_WIDTH / 2, BASE_HEIGHT / 2 + 70);
}

function drawErrorScreen() {
  textAlign(CENTER, CENTER);
  fill(220, 53, 69); 
  textSize(24);
  text("錯誤：無法載入 questions.csv 或檔案為空。", BASE_WIDTH / 2, BASE_HEIGHT / 2);
}

function drawQuizScreen() {
  optionBoxes = []; 
  let q = quiz[currentQuestionIndex];
  if (!q || !q.shuffledOptions) return; // 確保選項已處理

  drawProgressBar();

  // 顯示即時分數/答對題數
  textAlign(RIGHT, TOP);
  textSize(16);
  fill(0, 100, 0); 
  textStyle(BOLD);
  text(`✔ 答對: ${correctCount} / ${quiz.length}`, BASE_WIDTH - 50, QUESTION_TOP_Y - 35); // 稍微上移
  textStyle(NORMAL);

  // 繪製問題 
  textAlign(LEFT, TOP);
  textSize(30);
  fill(30, 40, 60);
  textWrap(WORD);
  text(q.question, 50, QUESTION_TOP_Y, BASE_WIDTH - 100); 

  // --- 繪製選項 (使用亂序後的選項) ---
  let optionLetters = ['A', 'B', 'C', 'D'];
  let startY = OPTIONS_START_Y;
  let optionHeight = 60;
  let optionSpacing = 15; 

  // 兩欄式佈局變數
  const BASE_MARGIN_X = 50; 
  const INNER_SPACING_X = 30; // 兩選項間的間距
  // 計算選項寬度：(總寬度 - 左右邊界 - 內部間距) / 2
  const optW = (BASE_WIDTH - (2 * BASE_MARGIN_X) - INNER_SPACING_X) / 2; // (800 - 100 - 30) / 2 = 335
  const optH = optionHeight; 

  for (let i = 0; i < q.shuffledOptions.length; i++) {
    let col = i % 2; // 第幾欄 (0: 左, 1: 右)
    let row = floor(i / 2); // 第幾行 (0, 1)
    
    // 計算 x 座標：左邊界 + 欄位索引 * (選項寬度 + 間距)
    let x = BASE_MARGIN_X + col * (optW + INNER_SPACING_X);
    // 計算 y 座標：起始 Y + 行索引 * (選項高度 + 間距)
    let y = startY + row * (optH + optionSpacing);
    let w = optW;
    let h = optH;
    
    // **注意：optionBoxes 儲存的是原始 BASE_WIDTH/HEIGHT 空間的座標**
    optionBoxes.push({ x, y, w, h, index: i, letter: optionLetters[i], type: 'option' });

    let isCorrectAnswer = q.shuffledOptions[i].isCorrect;
    let isUserChoice = (i === userChoiceIndex);

    let boxFill = color(255);
    let boxStroke = color(200);
    let strokeWeightVal = 2;
    let textColor = color(0);
    
    // 陰影
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = 'rgba(0, 0, 0, 0.05)';

    if (showAnswer) {
      if (isCorrectAnswer) {
        boxFill = color(230, 255, 235);
        boxStroke = color(40, 167, 69);
        textColor = color(40, 167, 69); 
        strokeWeightVal = 4; 
      } else if (isUserChoice) {
        boxFill = color(255, 230, 235);
        boxStroke = color(220, 53, 69);
        textColor = color(220, 53, 69); 
        strokeWeightVal = 4;
      } else {
        boxFill = color(245, 245, 245);
        boxStroke = color(220);
        textColor = color(180);
      }
      
    } else {
      // 處理 Hover 
      let currentScale = width / BASE_WIDTH;
      let scaledMouseX = mouseX / currentScale;
      let scaledMouseY = mouseY / currentScale;
      
      if (scaledMouseX > x && scaledMouseX < x + w && scaledMouseY > y && scaledMouseY < y + h) {
        boxFill = color(245, 250, 255); 
        boxStroke = color(0, 123, 255); 
        cursor(HAND); 
      }
    }

    // 繪製選項方塊
    fill(boxFill);
    stroke(boxStroke);
    strokeWeight(strokeWeightVal);
    rect(x, y, w, h, 12); 
    
    // 繪製選項文字
    noStroke();
    fill(textColor);
    textAlign(LEFT, CENTER);
    textSize(20);
    text(`${optionLetters[i]}. ${q.shuffledOptions[i].text}`, x + 25, y + h / 2);
  }
  
  // 清除陰影
  drawingContext.shadowBlur = 0;
  
  // 按鈕
  if (showAnswer) {
    drawNextButton(NEXT_BUTTON_Y); 
  }
}

function drawProgressBar() {
  let progress = (currentQuestionIndex + 1) / quiz.length;
  let barY = 30;
  let barH = 10;
  
  noStroke();
  fill(220);
  rect(50, barY, BASE_WIDTH - 100, barH, barH / 2);
  
  fill(0, 123, 255); 
  rect(50, barY, (BASE_WIDTH - 100) * progress, barH, barH / 2);
  
  textAlign(CENTER, CENTER);
  fill(80);
  textSize(14);
  text(`問題 ${currentQuestionIndex + 1} / ${quiz.length}`, BASE_WIDTH / 2, barY + barH + 15);
}

function drawNextButton(btnY) {
  let btnText = (currentQuestionIndex === quiz.length - 1) ? "查看結果" : "下一題";
  let btnW = 200;
  let btnH = 50;
  let btnX = BASE_WIDTH / 2 - btnW / 2; 

  // **注意：optionBoxes 儲存的是原始 BASE_WIDTH/HEIGHT 空間的座標**
  optionBoxes.push({ x: btnX, y: btnY, w: btnW, h: btnH, type: 'nextButton' }); 

  let btnColor = color(0, 123, 255); 
  
  // 為了處理鼠標樣式，我們需要將 mouseX/mouseY 反向縮放
  let currentScale = width / BASE_WIDTH;
  let scaledMouseX = mouseX / currentScale;
  let scaledMouseY = mouseY / currentScale;

  if (scaledMouseX > btnX && scaledMouseX < btnX + btnW && 
      scaledMouseY > btnY && scaledMouseY < btnY + btnH) {
    btnColor = color(0, 100, 220); 
    cursor(HAND);
  }
  
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = 'rgba(0, 123, 255, 0.3)';

  fill(btnColor);
  noStroke();
  rect(btnX, btnY, btnW, btnH, 12);
  
  drawingContext.shadowBlur = 0;
  
  fill(255);
  textSize(22);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text(btnText, btnX + btnW / 2, btnY + btnH / 2);
  textStyle(NORMAL);
}

function drawResultScreen() {
  score = (correctCount / quiz.length) * 100;
  
  textAlign(CENTER, CENTER);
  noStroke();
  
  // 1. 顯示答對題數 (作為輔助資訊)
  fill(100, 120, 150);
  textSize(28);
  textStyle(NORMAL);
  text(`答對題數: ${correctCount} / ${quiz.length} 題`, BASE_WIDTH / 2, BASE_HEIGHT / 3 - 40);
  
  // 2. 顯示最終分數 (大字體，突出顯示百分比)
  fill(30, 40, 60);
  textSize(64); // 字體加大，讓分數更醒目
  textStyle(BOLD);
  text(`${round(score)} %`, BASE_WIDTH / 2, BASE_HEIGHT / 3 + 20); 
  textStyle(NORMAL);

  if (score >= 100) { 
    drawMasterAnimation(); 
  } else if (score >= 80) {
    drawExcellentAnimation(); 
  } else if (score >= 60) {
    drawGoodAnimation(); 
  } else {
    drawNeedsWorkAnimation(); 
  }
  
  fill(50);
  textSize(20);
  text("點擊任意處重新開始", BASE_WIDTH / 2, BASE_HEIGHT - 60);
}


// --------------------
// 四種結果動畫函數 (座標改用 BASE_WIDTH/HEIGHT)
// --------------------

function drawMasterAnimation() {
  textSize(32);
  fill(218, 165, 32); 
  text("完美！程式設計大師！ 🏆", BASE_WIDTH / 2, BASE_HEIGHT / 2);
  
  if (frameCount % 1 === 0) {
    // 粒子在實際畫布座標產生
    particles.push(new Particle(random(width), -20 * scaleFactor, 'confetti'));
  }
}

function drawExcellentAnimation() {
  textSize(32);
  fill(0, 123, 255); 
  text("表現出色！接近滿分！ ✨", BASE_WIDTH / 2, BASE_HEIGHT / 2);
  
  if (frameCount % 5 === 0) {
    particles.push(new Particle(random(width / 3, 2 * width / 3), height, 'starDust'));
  }
}

function drawGoodAnimation() {
  textSize(32);
  fill(40, 167, 69); 
  text("表現良好，保持進步！ 👍", BASE_WIDTH / 2, BASE_HEIGHT / 2);
  
  if (frameCount % 10 === 0) {
    particles.push(new Particle(random(width), height + 20 * scaleFactor, 'bubble'));
  }
}

function drawNeedsWorkAnimation() {
  textSize(32);
  fill(220, 53, 69); 
  text("別灰心，下次會更好！ 💪", BASE_WIDTH / 2, BASE_HEIGHT / 2);
  
  if (frameCount % 20 === 0) {
    particles.push(new Particle(random(width), -10 * scaleFactor, 'motivational'));
  }
}


// --------------------
// 測驗邏輯函數 (保持不變)
// --------------------

function goToNextQuestion() {
  if (currentQuestionIndex < quiz.length - 1) {
    currentQuestionIndex++;
    showAnswer = false; 
    userChoiceIndex = -1; 
  } else {
    gameState = 'RESULT';
  }
}

// 增加了重啟時是否重設背景粒子的參數
function restartQuiz(resetParticles) {
  score = 0;
  correctCount = 0; 
  currentQuestionIndex = 0;
  userAnswers = new Array(quiz.length).fill(null);
  userChoiceIndex = -1;
  showAnswer = false;
  
  if (resetParticles) {
    particles = []; 
    // **粒子在實際畫布座標產生**
    for (let i = 0; i < 20; i++) {
      particles.push(new Particle(random(width), random(height), 'backgroundBubble'));
    }
    gameState = 'START';
  }
}

// --------------------
// 特效與粒子類別 (保持不變)
// --------------------

function updateAndDrawEffects() {
  // **粒子邏輯保持使用實際的 mouseX/Y 和 width/height 座標**
  if (dist(mouseX, mouseY, pmouseX, pmouseY) > 2) {
      cursorParticles.push(new Particle(mouseX, mouseY, 'cursor'));
  }
  
  for (let i = cursorParticles.length - 1; i >= 0; i--) {
    cursorParticles[i].update();
    cursorParticles[i].show();
    if (cursorParticles[i].isFinished()) {
      cursorParticles.splice(i, 1);
    }
  }
  
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].isFinished()) {
      particles.splice(i, 1);
    }
  }
}

class Particle {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.lifespan = 255; 
    
    // **調整粒子的速度/大小以適應縮放**
    let speedScale = (scaleFactor < 1) ? 1.5 / scaleFactor : 1.5;

    if (this.type === 'cursor' || this.type === 'clickBurst') {
      let angle = (this.type === 'clickBurst') ? random(TWO_PI) : 0;
      let speed = (this.type === 'clickBurst') ? random(1, 4) : random(-1.5, 1.5);
      this.vx = (this.type === 'clickBurst') ? cos(angle) * speed : random(-1.5, 1.5) * speedScale;
      this.vy = (this.type === 'clickBurst') ? sin(angle) * speed : random(-1.5, 1.5) * speedScale;
      this.size = random(3, 7) * scaleFactor;
      this.color = color(0, 123, 255); 
    } 
    else if (this.type === 'confetti') {
      this.vx = random(-4, 4) * speedScale;
      this.vy = random(-12, -6) * speedScale; 
      this.gravity = 0.4 * speedScale;
      this.size = random(8, 15) * scaleFactor;
      colorMode(HSB, 360, 100, 100);
      this.color = color(random(360), 80, 100); 
      colorMode(RGB, 255); 
      this.angle = random(TWO_PI);
      this.spin = random(-0.1, 0.1);
    } 
    else if (this.type === 'bubble' || this.type === 'backgroundBubble') {
      this.vx = random(-0.5, 0.5) * speedScale;
      this.vy = (this.type === 'bubble') ? random(-2, -4) * speedScale : random(-0.5, -1.5) * speedScale; 
      this.size = random(10, 30) * scaleFactor;
      this.color = color(0, 150, 255, 50); 
      if(this.type === 'backgroundBubble') {
         this.color = color(255, 255, 255, 80); 
         this.lifespan = Infinity; 
      }
    }
    // 星塵 (Excellent)
    else if (this.type === 'starDust') {
        this.vx = random(-0.2, 0.2) * speedScale;
        this.vy = random(-2, -4) * speedScale; 
        this.size = random(2, 5) * scaleFactor;
        this.color = color(200, 220, 255); 
    }
    // 激勵 (Needs Work)
    else if (this.type === 'motivational') {
        this.vx = random(-1, 1) * speedScale;
        this.vy = random(1, 3) * speedScale; 
        this.size = random(4, 8) * scaleFactor;
        this.color = color(255, 100, 100); 
    }
  }
  
  // (Particle 的 update 和 show 函數保持不變，因為它們是基於粒子的 this.x/y/size)
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    
    if (this.type === 'confetti') {
      this.vy += this.gravity; 
      this.angle += this.spin; 
    }
    
    if (this.type === 'cursor' || this.type === 'clickBurst' || 
        this.type === 'starDust' || this.type === 'motivational') {
        this.lifespan -= 6; 
    } else if (this.type === 'confetti' || this.type === 'bubble') {
        this.lifespan -= 3;
    }
    
    if (this.type === 'backgroundBubble') {
      if (this.y < -this.size) {
        this.y = height + this.size;
        this.x = random(width);
      }
    }
  }

  show() {
    noStroke();
    let c = this.color;
    
    if (this.type === 'cursor' || this.type === 'clickBurst' || this.type === 'starDust' || this.type === 'motivational') {
      fill(c.levels[0], c.levels[1], c.levels[2], this.lifespan);
      ellipse(this.x, this.y, this.size);
    } else if (this.type === 'confetti') {
      push();
      translate(this.x, this.y);
      rotate(this.angle);
      colorMode(HSB, 360, 100, 100, 100);
      fill(hue(c), saturation(c), brightness(c), this.lifespan / 2.55);
      rect(0, 0, this.size, this.size / 2);
      pop();
      colorMode(RGB, 255); 
    } else if (this.type === 'bubble' || this.type === 'backgroundBubble') {
      let alpha = (this.type === 'bubble') ? c.levels[3] * (this.lifespan / 255) : c.levels[3];
      fill(c.levels[0], c.levels[1], c.levels[2], alpha);
      stroke(255, alpha / 2);
      strokeWeight(1);
      ellipse(this.x, this.y, this.size);
    }
  }

  isFinished() {
    if (this.type === 'backgroundBubble') return false; 
    if (this.type === 'confetti' && this.y > height + this.size) return true;
    if (this.type === 'bubble' && this.y < -this.size) return true;
    if (this.type === 'motivational' && this.y > height + this.size) return true;
    return this.lifespan < 0;
  }
}