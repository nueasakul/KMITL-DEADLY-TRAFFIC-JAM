// ==========================================
// 1. AI & Teachable Machine Section
// ==========================================
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/IsprmHhpG/";
const CONFIDENCE_LIMIT = 0.70;
let model;
let webcam;
let ctx;
let maxPredictions;
let isCameraRunning = false;
let uploadedImageReady = false;

let scanTimer = null;
let countdownSeconds = 2;

// ป้องกัน Error กรณีไม่มี element id="screen-size" ใน HTML
const display = document.getElementById('screen-size');

function updateSize() {
    if (!display) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    display.innerText = `${width} x ${height} px`;
}
updateSize();
window.addEventListener('resize', updateSize);

async function loadModel() {
    const loadBtn = document.getElementById("loadBtn");
    const actionText = document.getElementById("action");

    try {
        if (loadBtn) {
            loadBtn.disabled = true;
            loadBtn.innerHTML = "กำลังโหลด...";
        }
        if (actionText) actionText.innerHTML = "สถานะ: กำลังโหลดโมเดล";

        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";

        model = await tmPose.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        const scoreListContainer = document.getElementById("scoreList");
        if (scoreListContainer) {
            scoreListContainer.innerHTML = "";
            for (let i = 0; i < maxPredictions; i++) {
                const itemDiv = document.createElement("div");
                itemDiv.className = "score-item";
                itemDiv.innerHTML = `
                    <span id="className-${i}" class="score-name">Class ${i + 1}</span>
                    <span id="classScore-${i}" class="score-percent">-</span>
                `;
                scoreListContainer.appendChild(itemDiv);
            }
        }

        if (actionText) actionText.innerHTML = `สถานะ: โหลดสำเร็จ (พบ ${maxPredictions} Class)`;

        // ใช้ ?. ป้องกัน Error หากไม่มี element ID นี้ใน HTML
        const cameraBtn = document.getElementById("cameraBtn");
        if (cameraBtn) cameraBtn.disabled = false;

        const imageUpload = document.getElementById("imageUpload");
        if (imageUpload) imageUpload.disabled = false;

        if (loadBtn) loadBtn.innerHTML = "โหลดโมเดลแล้ว";
    } catch (error) {
        console.error(error);
        if (loadBtn) {
            loadBtn.disabled = false;
            loadBtn.innerHTML = "โหลดโมเดล";
        }
        if (actionText) actionText.innerHTML = "เกิดข้อผิดพลาด: โหลดโมเดลไม่ได้";
    }
}

async function startCamera() {
    if (!model) {
        alert("กรุณาโหลดโมเดลก่อน");
        return;
    }

    const cameraBtn = document.getElementById("cameraBtn");
    const stopBtn = document.getElementById("stopBtn");
    const actionText = document.getElementById("action");

    try {
        if (cameraBtn) cameraBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;

        const webcamCanvas = document.getElementById("webcamCanvas");
        if (webcamCanvas) webcamCanvas.style.display = "block";

        if (actionText) actionText.innerHTML = "สถานะ: กำลังเปิดกล้อง";

        const size = 400;
        const flip = true;

        webcam = new tmPose.Webcam(size, size, flip);

        await webcam.setup();
        await webcam.play();

        const canvas = document.getElementById("webcamCanvas");
        if (canvas) {
            canvas.width = size;
            canvas.height = size;
            ctx = canvas.getContext("2d");
        }

        isCameraRunning = true;
        if (actionText) actionText.innerHTML = "สถานะ: เปิดกล้องแล้ว เริ่มคุมจราจร!";

        if (webcam && webcam.canvas) {
            await predict(webcam.canvas);
        }

        window.requestAnimationFrame(loop);
    } catch (error) {
        console.error(error);
        if (cameraBtn) cameraBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (actionText) actionText.innerHTML = "เกิดข้อผิดพลาด: เปิดกล้องไม่ได้";
    }
}

async function stopCamera() {
    isCameraRunning = false; // สั่งหยุด Loop สแกนภาพ

    // หยุดการทำงานของกล้อง
    if (webcam) {
        webcam.stop();
    }

    // ล้างหน้าจอ Canvas พรีวิวกดเปิด/ปิดกล้อง
    const webcamCanvas = document.getElementById("webcamCanvas");
    if (webcamCanvas && ctx) {
        ctx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);
    }

    // อัปเดตสถานะปุ่มและข้อความ
    const cameraBtn = document.getElementById("cameraBtn");
    const stopBtn = document.getElementById("stopBtn");
    const actionText = document.getElementById("action");

    if (cameraBtn) cameraBtn.disabled = false; // เปิดให้กดเปิดกล้องได้อีกครั้ง
    if (stopBtn) stopBtn.disabled = true;     // ปิดปุ่มหยุดกล้อง
    if (actionText) actionText.innerHTML = "สถานะ: ปิดกล้องแล้ว";
}

async function loop() {
    if (!isCameraRunning) return;

    webcam.update();
    ctx.drawImage(webcam.canvas, 0, 0);

    // 👈 ใส่คำสั่งตรวจจับท่าทางแบบ Real-time ตรงนี้
    if (webcam && webcam.canvas) {
        await predict(webcam.canvas);
    }

    window.requestAnimationFrame(loop);
}

function updateNextRoundUI(val) {
    const el = document.getElementById("nextRound");

    if (!el) return;

    if (typeof val === "number") {
        el.innerHTML = `สแกนท่าทางใน: ${val} วินาที`;
    } else {
        el.innerHTML = `สถานะ: ${val}`;
    }
}

async function predict(inputElement) {
    const { pose, posenetOutput } = await model.estimatePose(inputElement);
    const prediction = await model.predict(posenetOutput);

    let highestScore = -1;
    let highestName = "";

    for (let i = 0; i < maxPredictions; i++) {
        const className = prediction[i].className;
        const classScore = prediction[i].probability;

        document.getElementById(`className-${i}`).innerHTML = className;
        document.getElementById(`classScore-${i}`).innerHTML = (classScore * 100).toFixed(2) + "%";

        if (classScore > highestScore) {
            highestScore = classScore;
            highestName = className;
        }
    }

    document.getElementById("confidence").innerHTML = "ความมั่นใจ: " + (highestScore * 100).toFixed(2) + "%";

    if (highestScore < CONFIDENCE_LIMIT) {
        document.getElementById("result").innerHTML = "ผลลัพธ์: ไม่แน่ใจ";
        document.getElementById("action").innerHTML = "สถานะ: ไม่พบท่าทางที่ชัดเจน";
        document.body.style.background = "linear-gradient(135deg, #ffe8e8, #ffffff)";
    } else {
        document.getElementById("result").innerHTML = "ผลลัพธ์: " + highestName;
        document.getElementById("action").innerHTML = "สั่งการ: " + highestName;
        document.body.style.background = "linear-gradient(135deg, #e8ffe8, #f7fff7)";

        applyTrafficControl(highestName);
    }
}

// ==========================================
// 2. Game Engine - Crazy Traffic Cop
// ==========================================
const gCanvas = document.getElementById("gameCanvas");
const gCtx = gCanvas.getContext("2d");
let isMapLoaded = false;
const mapImage = new Image();
mapImage.onload = () => {
    isMapLoaded = true; // เมื่อรูปโหลดเสร็จแล้วค่อยเปิดสถานะพร้อมวาด
    drawMap();
}
mapImage.src = 'map.jpg'; // เปลี่ยนเป็นชื่อ/ที่อยู่ไฟล์รูปของคุณ
// โหลดไฟล์เสียงเตรียมไว้ (ระบุตัวพิมพ์เล็ก-ใหญ่ให้ตรงกับชื่อไฟล์ในโฟลเดอร์)
const winSound = new Audio('WinSound.m4a');
const lossSound = new Audio('lossSound.m4a');

let trafficState = 'ALL_STOP';
let gameTimer = 60; // 60 วินาที (1 นาที)
let timerInterval = null
let passedCarsCount = 0;
let isGameOver = false;
let isGameStarted = false;
let spawnCounter = 0;
let spawnRate = 60;
let animationFrameId = null;

const ROAD_W = 90;
const CENTER_X = gCanvas.width / 2;
const CENTER_Y = gCanvas.height / 2;

const STOP_NORTH = CENTER_Y - ROAD_W / 2 - 10;
const STOP_SOUTH = CENTER_Y + ROAD_W / 2 + 10;
const STOP_WEST = CENTER_X - ROAD_W / 2 - 10;
const STOP_EAST = CENTER_X + ROAD_W / 2 + 10;

let carsList = [];

function drawMap() {
    if (isMapLoaded) {
        gCtx.drawImage(mapImage, 0, 0, gCanvas.width, gCanvas.height);
    } else {
        gCtx.fillStyle = '#10b981';
        gCtx.fillRect(0, 0, gCanvas.width, gCanvas.height);
    }
}
class Car {
    constructor(dir) {
        this.dir = dir;
        this.width = 24;
        this.height = 42;
        this.baseSpeed = 5;
        this.speed = this.baseSpeed;
        this.color = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 5)];
        this.passedStopLine = false;

        // 👈 [เพิ่ม] ตัวแปรจับเวลาคนขับหัวร้อน
        this.waitTime = 0;
        this.isAngry = false;

        if (dir === 'N') {
            this.x = CENTER_X - ROAD_W / 4 - this.width / 2 + 40;
            this.y = -50;
        } else if (dir === 'S') {
            this.x = CENTER_X + ROAD_W / 4 - this.width / 2 - 38;
            this.y = gCanvas.height + 50;
        } else if (dir === 'W') {
            this.x = -50;
            this.y = CENTER_Y + ROAD_W / 4 - this.height / 2 - 30;
            this.width = 42; this.height = 24;
        } else if (dir === 'E') {
            this.x = gCanvas.width + 50;
            this.y = CENTER_Y - ROAD_W / 4 - this.height / 2 + 48;
            this.width = 42; this.height = 24;
        }
    }

    update() {
        let reachedStopLine = false;

        if (this.dir === 'N' && this.y + this.height >= STOP_NORTH) reachedStopLine = true;
        if (this.dir === 'S' && this.y <= STOP_SOUTH) reachedStopLine = true;
        if (this.dir === 'W' && this.x + this.width >= STOP_WEST) reachedStopLine = true;
        if (this.dir === 'E' && this.x <= STOP_EAST) reachedStopLine = true;

        if (reachedStopLine) {
            if (this.dir === 'N' && trafficState === 'NORTH_GO') this.passedStopLine = true;
            if (this.dir === 'S' && trafficState === 'SOUTH_GO') this.passedStopLine = true;
            if (this.dir === 'W' && trafficState === 'WEST_GO') this.passedStopLine = true;
            if (this.dir === 'E' && trafficState === 'EAST_GO') this.passedStopLine = true;
        }

        let mustStop = false;

        if (reachedStopLine && !this.passedStopLine) {
            if (trafficState === 'ALL_STOP') mustStop = true;
            else if (trafficState === 'WEST_GO' && this.dir !== 'W') mustStop = true;
            else if (trafficState === 'EAST_GO' && this.dir !== 'E') mustStop = true;
            else if (trafficState === 'NORTH_GO' && this.dir !== 'N') mustStop = true;
            else if (trafficState === 'SOUTH_GO' && this.dir !== 'S') mustStop = true;
        }

        for (let other of carsList) {
            if (other !== this && other.dir === this.dir) {
                if (this.dir === 'N' && other.y > this.y && other.y - (this.y + this.height) < 12) mustStop = true;
                if (this.dir === 'S' && other.y < this.y && this.y - (other.y + other.height) < 12) mustStop = true;
                if (this.dir === 'W' && other.x > this.x && other.x - (this.x + this.width) < 12) mustStop = true;
                if (this.dir === 'E' && other.x < this.x && this.x - (other.x + other.width) < 12) mustStop = true;
            }
        }

        // 👈 [เพิ่ม] ระบบนับเวลาหัวร้อน (10 วินาที = ประมาณ 600 เฟรม)
        if (mustStop) {
            this.waitTime++;
            if (this.waitTime >= 600) {
                this.isAngry = true;
            }
        } else {
            this.waitTime = 0;
        }

        // ถ้ารถหัวร้อนแล้ว จะยกเลิกการสั่งหยุด (ผ่าไฟแดงทันที!)
        if (this.isAngry) {
            mustStop = false;
        }

        this.speed = mustStop ? 0 : this.baseSpeed;

        if (this.dir === 'N') this.y += this.speed;
        if (this.dir === 'S') this.y -= this.speed;
        if (this.dir === 'W') this.x += this.speed;
        if (this.dir === 'E') this.x -= this.speed;
    }

    draw() {
        // ถ้ารถหัวร้อน เปลี่ยนสีตัวรถเป็นสีแดงเข้มกระพริบ
        gCtx.fillStyle = this.isAngry ? '#dc2626' : this.color;
        gCtx.fillRect(this.x, this.y, this.width, this.height);

        // 👈 [เพิ่ม] โชว์เอฟเฟกต์บีบแตร "BEEP!" เหนือรถ
        if (this.isAngry) {
            gCtx.fillStyle = '#facc15';
            gCtx.font = 'bold 12px sans-serif';
            gCtx.fillText('📢 BEEP!', this.x - 5, this.y - 6);
        }
    }

    isOffscreen() {
        return (this.x > gCanvas.width + 60 || this.x < -60 || this.y > gCanvas.height + 60 || this.y < -60);
    }
}

function startGame() {
    carsList = [];
    passedCarsCount = 0;
    spawnRate = 60;
    spawnCounter = 0;
    trafficState = 'ALL_STOP';
    isGameOver = false;
    isGameStarted = true;

    // รีเซ็ตตัวนับเวลา 60 วินาที
    gameTimer = 60;
    if (timerInterval) clearInterval(timerInterval);

    // สั่งนับถอยหลังทุกๆ 1 วินาที
    timerInterval = setInterval(() => {
        if (isGameStarted && !isGameOver) {
            gameTimer--;
            updateGameHUD();

            if (gameTimer <= 0) {
                if (timerInterval) clearInterval(timerInterval);

                // เช็กเงื่อนไข: ถ้ารถผ่านน้อยกว่า 40 คัน
                if (passedCarsCount < 40) {
                    endGame("⚠️ เวลาหมดแล้ว! แต่ปล่อยรถไม่ทันเป้าหมาย (ต้องได้ 40 คันขึ้นไป)");
                } else {
                    winGame(); // ผ่านเป้าหมาย = ชนะ
                }
            }
            if (passedCarsCount >= 40) {
                winGame(); // ผ่านเป้าหมาย = ชนะ
            }
        }
    }, 1000);

    const gameOverlay = document.getElementById("gameOverlay");
    if (gameOverlay) gameOverlay.classList.add("hidden");

    const startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.disabled = true;

    updateGameHUD();

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    runGameEngine();
}

function winGame() {
    winSound.currentTime = 0; // รีเซ็ตเวลาเสียงเริ่มใหม่
    winSound.play().catch(e => console.log("Audio play error:", e));

    isGameOver = true;
    isGameStarted = false;
    if (timerInterval) clearInterval(timerInterval);

    const overlayTitle = document.getElementById("overlayTitle");
    const overlaySub = document.getElementById("overlaySub");
    const overlayBtn = document.getElementById("overlayBtn");
    const gameOverlay = document.getElementById("gameOverlay");
    const startBtn = document.getElementById("startBtn");

    if (overlayTitle) {
        overlayTitle.innerText = "Victory!";
        overlayTitle.style.color = "#10b981";
    }
    if (overlaySub) overlaySub.innerText = "คุณผ่านสี่แยกมรณะโดยสวัสดิภาพ";
    if (overlayBtn) overlayBtn.innerText = "เล่นใหม่อีกครั้ง";
    if (gameOverlay) {
        gameOverlay.classList.remove("hidden");
        gameOverlay.style.display = "flex";
    }
    if (startBtn) startBtn.disabled = false;
}

function restartGame() {
    startGame();
}

function applyTrafficControl(className) {
    const name = className.trim().toLowerCase();

    if (name.includes("all") || name.includes("stop")) {
        trafficState = 'ALL_STOP';
    } else if (name.includes("left")) {
        trafficState = 'WEST_GO';  // ซ้ายไป
    } else if (name.includes("right")) {
        trafficState = 'EAST_GO';  // ขวาไป
    } else if (name.includes("up")) {
        trafficState = 'NORTH_GO'; // บนไป
    } else if (name.includes("down")) {
        trafficState = 'SOUTH_GO'; // ล่างไป
    }

    updateGameHUD();
}

window.addEventListener('keydown', (e) => {
    if (e.key === '1') trafficState = 'ALL_STOP';
    if (e.key === 'a') trafficState = 'WEST_GO';
    if (e.key === 'd') trafficState = 'EAST_GO';
    if (e.key === 'w') trafficState = 'NORTH_GO';
    if (e.key === 's') trafficState = 'SOUTH_GO';
    updateGameHUD();
});

function updateGameHUD() {
    // คำนวณแปลง 60 วินาที -> 01:00
    const minutes = Math.floor(gameTimer / 60);
    const seconds = gameTimer % 60;
    const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const timerEl = document.getElementById("gameTimer");
    if (timerEl) timerEl.innerText = timeString;

    document.getElementById("passedCars").innerText = passedCarsCount;
    const signalText = document.getElementById("currentSignal");

    if (trafficState === 'ALL_STOP') {
        signalText.innerText = "⛔ ทุกคนหยุด"; signalText.style.color = "#ef4444";
    } else if (trafficState === 'WEST_GO') {
        signalText.innerText = "⬅️ ซ้ายไป"; signalText.style.color = "#3b82f6";
    } else if (trafficState === 'EAST_GO') {
        signalText.innerText = "➡️ ขวาไป"; signalText.style.color = "#3b82f6";
    } else if (trafficState === 'NORTH_GO') {
        signalText.innerText = "⬆️ บนไป"; signalText.style.color = "#10b981";
    } else if (trafficState === 'SOUTH_GO') {
        signalText.innerText = "⬇️ ล่างไป"; signalText.style.color = "#10b981";
    }
}

function spawnTraffic() {
    if (!isGameStarted || isGameOver) return;

    spawnCounter++;
    if (spawnCounter >= spawnRate) {
        spawnCounter = 0;
        const dirs = ['N', 'S', 'E', 'W'];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];

        const isSpawnBlocked = carsList.some(c => {
            if (c.dir !== dir) return false;
            if (dir === 'N' && c.y > -50 && c.y < 80) return true;
            if (dir === 'S' && c.y < gCanvas.height + 50 && c.y > gCanvas.height - 80) return true;
            if (dir === 'W' && c.x > -50 && c.x < 80) return true;
            if (dir === 'E' && c.x < gCanvas.width + 50 && c.x > gCanvas.width - 80) return true;
            return false;
        });

        if (!isSpawnBlocked) {
            carsList.push(new Car(dir));
            if (spawnRate > 15) spawnRate -= 0.5; // เพิ่มความถี่ในการเกิดรถเมื่อเวลาผ่านไป
        }
    }
}

function checkAccidents() {
    for (let i = 0; i < carsList.length; i++) {
        for (let j = i + 1; j < carsList.length; j++) {
            const c1 = carsList[i];
            const c2 = carsList[j];

            const c1InScreen = c1.x >= 0 && c1.x + c1.width <= gCanvas.width && c1.y >= 0 && c1.y + c1.height <= gCanvas.height;
            const c2InScreen = c2.x >= 0 && c2.x + c2.width <= gCanvas.width && c2.y >= 0 && c2.y + c2.height <= gCanvas.height;

            if (c1InScreen && c2InScreen) {
                if (
                    c1.x < c2.x + c2.width &&
                    c1.x + c1.width > c2.x &&
                    c1.y < c2.y + c2.height &&
                    c1.y + c1.height > c2.y
                ) {
                    endGame();
                    return;
                }
            }
        }
    }
}

function endGame(reason = "Defeated!") {
    lossSound.currentTime = 0; // รีเซ็ตเวลาเสียงเริ่มใหม่
    lossSound.play().catch(e => console.log("Audio play error:", e));

    isGameOver = true;
    isGameStarted = false;
    if (timerInterval) clearInterval(timerInterval);

    const overlayTitle = document.getElementById("overlayTitle");
    const overlaySub = document.getElementById("overlaySub");
    const gameOverlay = document.getElementById("gameOverlay");
    const startBtn = document.getElementById("startBtn");

    if (overlayTitle) {
        overlayTitle.innerText = reason; // แสดงข้อความสาเหตุการแพ้ตามที่ส่งมา
        overlayTitle.style.color = "#ef4444";
    }
    if (overlaySub) overlaySub.innerText = "รถผ่านไปได้เพียง: " + passedCarsCount + " คัน";

    if (gameOverlay) {
        gameOverlay.classList.remove("hidden");
        gameOverlay.style.display = "flex";
    }
    if (startBtn) startBtn.disabled = false;
}

function runGameEngine() {
    if (isGameOver || !isGameStarted) return;

    drawMap();
    spawnTraffic();

    for (let i = carsList.length - 1; i >= 0; i--) {
        const c = carsList[i];
        c.update();
        c.draw();

        if (c.isOffscreen()) {
            carsList.splice(i, 1);
            passedCarsCount++;
            updateGameHUD();
        }
    }

    checkAccidents();
    checkTrafficJam();

    if (isGameStarted && !isGameOver) {
        animationFrameId = requestAnimationFrame(runGameEngine);
    }
}

function checkTrafficJam() {
    const waitingCounts = { N: 0, S: 0, W: 0, E: 0 };

    for (let c of carsList) {
        // นับเฉพาะรถที่จอดนิ่ง
        if (c.speed === 0) {
            waitingCounts[c.dir]++;

            // ถ้าเลนไหนมีรถจอดต่อคิวถึง 10 คัน จะสั่งแพ้ทันที
            if (waitingCounts[c.dir] >= 10) {
                endGame("🚗⚠️ รถติดสะสมยาวเกินไป! จราจรเป็นอัมพาต");
                return;
            }
        }
    }
}

updateGameHUD();
drawMap();