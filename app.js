// DOM 요소
const video = document.getElementById('video');
const canvas = document.getElementById('face-points');
const ctx = canvas.getContext('2d');
const scoreValue = document.getElementById('score-value');
const message = document.getElementById('message');
const messageCamera = document.getElementById('message-camera');
const videoWrapper = document.getElementById('video-wrapper');

// 앱 상태 변수
let isRunning = false;
let currentScore = 80;
let isMobile = window.innerWidth <= 480;

// 전역 카메라 상태 관리
window.cameraInitializing = false;
window.cameraStreamActive = false;

// 브라우저 환경 감지
const isDesktopBrowser = !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isAndroid = /Android/.test(navigator.userAgent);

// 창 크기 변경 감지
window.addEventListener('resize', () => {
    isMobile = window.innerWidth <= 480;
    if (video.videoWidth > 0) {
        resizeCanvas();
    }
});

// 캔버스 크기 조정 함수
function resizeCanvas() {
    const wrapperWidth = videoWrapper.clientWidth;
    const wrapperHeight = videoWrapper.clientHeight;
    
    // 비디오 비율 계산
    const videoRatio = video.videoWidth / video.videoHeight;
    const wrapperRatio = wrapperWidth / wrapperHeight;
    
    let canvasWidth, canvasHeight;
    
    if (videoRatio > wrapperRatio) {
        // 비디오가 더 넓은 경우
        canvasHeight = wrapperHeight;
        canvasWidth = wrapperHeight * videoRatio;
    } else {
        // 비디오가 더 좁은 경우
        canvasWidth = wrapperWidth;
        canvasHeight = wrapperWidth / videoRatio;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // 캔버스 위치 조정 (중앙 정렬)
    canvas.style.left = `${(wrapperWidth - canvasWidth) / 2}px`;
    canvas.style.top = `${(wrapperHeight - canvasHeight) / 2}px`;
    
    console.log(`캔버스 크기 조정: ${canvasWidth} x ${canvasHeight}`);
}

// Face-API.js 모델 로드 및 앱 초기화
async function init() {
    try {
        console.log("앱 초기화 시작: 브라우저 환경 - " + (isDesktopBrowser ? "데스크톱" : "모바일"));
        
        // 이미 카메라가 활성화되어 있는지 확인
        if (window.cameraStreamActive) {
            console.log("카메라가 이미 활성화되어 있습니다. 초기화 생략.");
            
            // 이미 카메라가 작동 중이라면 얼굴 감지만 시작
            if (!isRunning) {
                isRunning = true;
                startFaceDetection();
            }
            
            messageCamera.innerText = '얼굴을 카메라에 맞춰주세요';
            return;
        }
        
        // 메시지 요소 확인
        if (!messageCamera) {
            console.error("카메라 메시지 요소를 찾을 수 없습니다");
            return;
        }
        
        messageCamera.innerText = '모델을 로딩하는 중...';
        
        // 모델 URL (CDN에서 모델 로드)
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        console.log("Face-API.js 모델 로딩 시작");
        
        // 모델 로드 - 표정 인식 모델 추가
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL) // 표정 인식 모델 추가
        ]).catch(err => {
            console.error("모델 로드 중, 오류:", err);
            messageCamera.innerText = '모델 로드 중 오류가 발생했습니다: ' + err.message;
            throw err;
        });
        
        console.log("Face-API.js 모델 로딩 완료");
        
        messageCamera.innerText = '카메라 시작 중...';
        
        // 카메라 초기화
        await setupCamera();
        
        // 얼굴 감지 시작
        isRunning = true;
        startFaceDetection();
        
        messageCamera.innerText = '얼굴을 카메라에 맞춰주세요';
    } catch (error) {
        console.error('초기화 실패:', error);
        messageCamera.innerText = '카메라 접근에 실패했습니다: ' + error.message;
        
        // 재시도 버튼 표시
        const retryButton = document.getElementById('retry-camera-button');
        if (retryButton) {
            retryButton.style.display = 'block';
        }
    }
}

// 카메라 설정
async function setupCamera() {
    try {
        // 이미 카메라 스트림이 활성화되어 있으면 중복 초기화 방지
        if (window.cameraStreamActive && video.srcObject) {
            console.log("카메라가 이미 활성화되어 있습니다. setupCamera 호출 무시");
            return Promise.resolve();
        }
        
        // 각 플랫폼별 제약 조건 설정
        let constraints = { 
            video: { 
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        };
        
        // 모바일 기기별 특수 설정 적용
        if (isIOS) {
            console.log("iOS, 특수 설정 적용");
            constraints.video = {
                facingMode: 'user',
                width: { min: 320, ideal: 640, max: 1280 },
                height: { min: 240, ideal: 480, max: 720 }
            };
        } else if (isAndroid) {
            console.log("안드로이드, 특수 설정 적용");
            constraints.video = {
                facingMode: 'user',
                width: { min: 320, ideal: 640, max: 1280 },
                height: { min: 240, ideal: 480, max: 720 }
            };
        }
        
        // 카메라 스트림 가져오기
        console.log("카메라 스트림 요청 중...");
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // 비디오 요소 설정
        video.srcObject = stream;
        video.setAttribute('playsinline', true); // iOS에서 중요
        video.setAttribute('autoplay', true);
        video.muted = true;
        
        // 전역 플래그 설정
        window.cameraStreamActive = true;
        
        // 비디오 로드 완료 대기
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                // 캔버스 크기 조정
                resizeCanvas();
                
                // 비디오 재생
                video.play()
                    .then(() => {
                        console.log("카메라 초기화 성공");
                        resolve();
                    })
                    .catch(error => {
                        console.error("비디오 재생 오류:", error);
                        // 오류가 발생해도 성공한 것으로 처리 (iOS에서 중요)
                        resolve();
                    });
            };
            
            // 비디오 오류 처리
            video.onerror = (err) => {
                console.error("비디오 요소 오류:", err);
                throw new Error("비디오 요소 오류");
            };
        });
    } catch (error) {
        console.error("카메라 접근 오류:", error.name, error.message);
        throw error;
    }
}

// 얼굴 감지 및 표정 분석 시작
function startFaceDetection() {
    isRunning = true;
    detectFace();
}

// 실시간 얼굴 감지 및 분석
async function detectFace() {
    if (!isRunning) return;
    
    try {
        const detections = await faceapi.detectSingleFace(
            video, 
            new faceapi.TinyFaceDetectorOptions({
                inputSize: isMobile ? 224 : 320,
                scoreThreshold: 0.5
            })
        ).withFaceLandmarks()
         .withFaceExpressions(); // 표정 인식 추가
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (detections) {
            const displaySize = { width: canvas.width, height: canvas.height };
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            // 표정 인식을 활용한 웃음/찡그림 분석하기
            analyzeSmileWithExpressions(resizedDetections);
        } else {
            messageCamera.innerText = '얼굴이 감지되지 않았습니다';
        }
        
        requestAnimationFrame(detectFace);
    } catch (error) {
        console.error('얼굴 감지 오류:', error);
        messageCamera.innerText = '얼굴 감지 중 오류가 발생했습니다';
        setTimeout(() => {
            if (isRunning) detectFace();
        }, 2000); // 에러 발생 시 2초 후 재시도
    }
}

// 점 그리기 헬퍼 함수
function drawPoints(points, radius, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < points.length; i++) {
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, radius, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// 표정 인식을 활용한 웃음/찡그림 분석하기
function analyzeSmileWithExpressions(detections) {
    // 표정 인식 결과 가져오기
    const expressions = detections.expressions;
    console.log('표정 인식 결과:', expressions);
    
    // 주요 표정 값 추출 (0~1 사이 값)
    const happyScore = expressions.happy;      // 행복/웃음
    const sadScore = expressions.sad;          // 슬픔
    const angryScore = expressions.angry;      // 화남
    const surprisedScore = expressions.surprised; // 놀람
    const neutralScore = expressions.neutral;  // 중립적
    
    // 디버깅 정보 출력
    console.log('웃음 점수:', (happyScore * 100).toFixed(2));
    console.log('슬픔 점수:', (sadScore * 100).toFixed(2));
    console.log('화남 점수:', (angryScore * 100).toFixed(2));
    
    // 기본 점수 계산 (웃음은 긍정적, 슬픔/화남은 부정적)
    let baseScore = 80; // 기본 점수 (중립)
    
    // 행복 점수에 따른 추가 점수 (최대 17점)
    const happyBonus = Math.round(happyScore * 17);
    
    // 부정적 표정에 따른 감점 (최대 -20점)
    const negativeScore = Math.round((sadScore + angryScore) * 20);
    
    // 최종 점수 계산 (긍정 보너스 더하고 부정 점수 빼기)
    let smileScore = baseScore + happyBonus - negativeScore;
    
            // 점수 범위 제한 (60점 ~ 100점)
        smileScore = Math.max(60, Math.min(100, smileScore));
    
    // 이전 랜드마크 기반 분석과의 혼합을 위해 입 모양도 분석
    const mouth = detections.landmarks.getMouth();
    
    // 입 모양 분석을 위한 주요 포인트
    const topLip = mouth[14];    // 윗입술 중앙
    const bottomLip = mouth[18]; // 아랫입술 중앙
    const leftCorner = mouth[0]; // 왼쪽 입꼬리
    const rightCorner = mouth[6];// 오른쪽 입꼬리
    
    // 입꼬리 위치 분석 (U자형 vs 역U자형)
    const lipCenter = (topLip.y + bottomLip.y) / 2;
    const cornerHeight = (leftCorner.y + rightCorner.y) / 2;
    const lipCurve = (lipCenter - cornerHeight) / Math.abs(bottomLip.y - topLip.y);
    
    // 입 곡률에 따른 미세 조정 (최대 ±5점)
    if (lipCurve > 0.1) { // 입꼬리가 올라간 경우 (웃는 표정)
        smileScore += 3;
    } else if (lipCurve < -0.1) { // 입꼬리가 내려간 경우 (찡그린 표정)
        smileScore -= 5;
    }
    
    // 최종 점수 범위 재확인
            smileScore = Math.max(60, Math.min(100, smileScore));
    
    // 점수 변화를 더 민감하게 조정 (이전 가중치 조정)
    currentScore = currentScore * 0.5 + smileScore * 0.5;
    
    // 점수 표시 업데이트
    scoreValue.style.fontWeight = 'bold';
    scoreValue.style.color = '#3498db';  // 항상 파란색으로 표시
    scoreValue.innerText = Math.round(currentScore);
    
    // 메시지 업데이트
    updateMessage(currentScore);
}

// 점수에 따른 메시지 업데이트
function updateMessage(score) {
    const roundedScore = Math.round(score);
    message.style.fontWeight = 'bold';
    message.style.color = '#3498db';  // 메시지도 파란색으로 통일
    
    if (roundedScore >= 100) {
        message.innerText = '축하합니다! 완벽한 100점! 🎉🎉';
        // 100점 달성 시 축하 효과 실행
        triggerCelebration();
    } else if (roundedScore >= 97) {
        message.innerText = '완벽한 웃음이에요! 😊😊';
    } else if (roundedScore >= 95) {
        message.innerText = '활짝 웃는 얼굴이에요! 😊';
    } else if (roundedScore >= 90) {
        message.innerText = '기분 좋게 웃고 있어요! 😄';
    } else if (roundedScore >= 85) {
        message.innerText = '살짝 웃고 있네요! 🙂';
    } else if (roundedScore >= 80) {
        message.innerText = '자연스러운 표정이에요. 😌';
    } else if (roundedScore >= 75) {
        message.innerText = '살짝 찡그리고 있어요. 😕';
    } else if (roundedScore >= 70) {
        message.innerText = '조금 찡그리고 있어요. 😣';
    } else if (roundedScore >= 65) {
        message.innerText = '많이 찡그리고 있어요. 😖';
    } else {
        message.innerText = '너무 찡그리고 있어요! 힘내세요! 😫';
    }
}

// 카메라 재시도 함수
function retryCamera() {
    // 재시도 버튼 숨기기
    const retryButton = document.getElementById('retry-camera-button');
    if (retryButton) {
        retryButton.style.display = 'none';
    }
    
    // 기존 카메라 스트림 정리
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    // 기존 초기화 플래그 제거
    window.cameraInitializing = false;
    window.cameraStreamActive = false;
    
    // 1초 후 다시 시도
    setTimeout(() => {
        init();
    }, 1000);
}

// 100점 달성 시 축하 효과 함수
function triggerCelebration() {
    // 풍선과 꽃바람 효과 생성
    createBalloonAndFlowerEffect();
    
    // 축하 사운드 재생
    playCelebrationSound();
    
    // 3초 후 효과 정리
    setTimeout(() => {
        clearCelebrationEffects();
    }, 3000);
}

// 풍선과 꽃바람 효과 생성
function createBalloonAndFlowerEffect() {
    const effectCount = 60;
    const balloons = ['🎈', '🎁', '✨'];
    const flowers = ['🌸', '🌺', '🌻', '🌷', '🌹', '💐'];
    
    for (let i = 0; i < effectCount; i++) {
        setTimeout(() => {
            const element = document.createElement('div');
            
            // 풍선과 꽃을 랜덤하게 선택
            if (i % 3 === 0) {
                element.innerHTML = balloons[Math.floor(Math.random() * balloons.length)];
                element.className = 'celebration-balloon';
            } else {
                element.innerHTML = flowers[Math.floor(Math.random() * flowers.length)];
                element.className = 'celebration-flower';
            }
            
            element.style.position = 'fixed';
            element.style.left = Math.random() * window.innerWidth + 'px';
            element.style.top = '-50px';
            element.style.fontSize = (15 + Math.random() * 10) + 'px';
            element.style.zIndex = '9999';
            element.style.pointerEvents = 'none';
            
            // 풍선은 위로 올라가고, 꽃은 아래로 떨어짐
            if (element.className === 'celebration-balloon') {
                element.style.animation = 'balloon-float 4s ease-out forwards';
            } else {
                element.style.animation = 'flower-fall 3s ease-out forwards';
            }
            
            // CSS 애니메이션 추가
            if (!document.getElementById('celebration-style')) {
                const style = document.createElement('style');
                style.id = 'celebration-style';
                style.textContent = `
                    @keyframes balloon-float {
                        0% {
                            transform: translateY(0px) rotate(0deg);
                            opacity: 1;
                        }
                        100% {
                            transform: translateY(-${window.innerHeight + 200}px) rotate(360deg);
                            opacity: 0;
                        }
                    }
                    @keyframes flower-fall {
                        0% {
                            transform: translateY(0px) rotate(0deg);
                            opacity: 1;
                        }
                        100% {
                            transform: translateY(${window.innerHeight + 100}px) rotate(720deg);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(element);
            
            // 4초 후 자동 제거
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            }, 4000);
        }, i * 30); // 조금 더 빠르게 순차적으로 생성
    }
}

// 축하 사운드 재생 (clap sound)
function playCelebrationSound() {
    try {
        const audio = new Audio('clap.MP3');
        audio.volume = 0.7; // 초기 볼륨 조절 (0.0 ~ 1.0)
        
        audio.play().catch(error => {
            console.log('사운드 재생 중 오류:', error);
        });
        
        // 2초 후부터 볼륨을 빠르게 줄이기 시작
        setTimeout(() => {
            const fadeOutInterval = setInterval(() => {
                if (audio.volume > 0.05) {
                    audio.volume = Math.max(0, audio.volume - 0.15); // 볼륨을 더 빠르게 줄임
                } else {
                    audio.volume = 0; // 완전히 무음
                    clearInterval(fadeOutInterval);
                }
            }, 80); // 0.08초마다 볼륨 조절 (더 빠르게)
        }, 2000); // 2초 후 시작
        
        // 4초 후 완전히 정지
        setTimeout(() => {
            audio.pause();
            audio.currentTime = 0; // 재생 위치를 처음으로 되돌림
        }, 4000);
        
    } catch (error) {
        console.log('오디오 재생을 지원하지 않는 브라우저입니다.');
    }
}

// 축하 효과 정리
function clearCelebrationEffects() {
    const celebrationElements = document.querySelectorAll('.celebration-balloon, .celebration-flower');
    celebrationElements.forEach(el => {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    });
}

// 브라우저가 로드되면 앱 초기화
window.addEventListener('load', init); 