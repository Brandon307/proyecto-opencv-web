let video = document.getElementById('videoInput');
let canvas = document.getElementById('canvasOutput');
let ctx = canvas.getContext('2d');
let statusEl = document.getElementById('status');
let blinkCountEl = document.getElementById('blinkCount');
let eyebrowCountEl = document.getElementById('eyebrowCount');
let mouthCountEl = document.getElementById('mouthCount');

let net, facemark;
let streaming = false;
let src, faces, cap, landmarks;

let blinkCount = 0;
let lastBlink = false;

let mouthCount = 0;
let lastMouthDetected = false;

let eyebrowCount = 0;
let lastEyebrowRaised = false;

let loadAttempt = 0;
const MAX_LOAD_ATTEMPTS = 3;
const LOAD_TIMEOUT_MS = 10000;

function loadModelsAndStartApp() {
    loadAttempt++;
    statusEl.innerText = `✅ Cargando modelos... Intento ${loadAttempt}`;

    const loadTimeout = setTimeout(() => {
        if (loadAttempt < MAX_LOAD_ATTEMPTS) {
            console.warn("⚠️ Carga de modelos agotó el tiempo de espera. Reintentando...");
            loadModelsAndStartApp();
        } else {
            console.error("❌ Fallo en la carga de modelos después de múltiples intentos.");
            statusEl.innerText = "❌ No se pudieron cargar los modelos. Intenta recargar la página.";
        }
    }, LOAD_TIMEOUT_MS);

    // Load DNN face detector model using cv.Net()
    net = new cv.Net();
    fetch('models/deploy_face.prototxt').then(response => response.text()).then(proto => {
        fetch('models/res10_300x300_ssd_iter_140000_fp16.caffemodel').then(response => response.arrayBuffer()).then(weights => {
            net.readFromModelOptimizer(proto, new Uint8Array(weights));
        });
    });

    // Load Facemark LBF model
    facemark = new cv.FaceMarkLBF();
    facemark.loadModel('models/lbfmodel.yaml');

    src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    faces = new cv.RectVector();
    landmarks = new cv.MatVector();

    statusEl.innerText = "✅ Modelos cargados. Iniciando cámara...";
    startCamera();
}

function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function(stream) {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                streaming = true;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                cap = new cv.VideoCapture(video);
                processVideo();
            };
        })
        .catch(function(err) {
            console.error("❌ Error al iniciar la cámara: " + err);
            statusEl.innerText = "❌ Error al iniciar la cámara. Asegúrate de dar permisos.";
        });
}

function processVideo() {
    if (!streaming) {
        return;
    }

    cap.read(src);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Detect faces using DNN
    let blob = cv.blobFromImage(src, 1.0, new cv.Size(300, 300), new cv.Scalar(104, 177, 123, 0), false, false);
    net.setInput(blob);
    let detections = net.forward();
    faces.clear();
    for (let i = 0; i < detections.size[2]; i++) {
        let confidence = detections.data32F[7 * i + 2];
        if (confidence > 0.5) {
            let x1 = detections.data32F[7 * i + 3] * src.cols;
            let y1 = detections.data32F[7 * i + 4] * src.rows;
            let x2 = detections.data32F[7 * i + 5] * src.cols;
            let y2 = detections.data32F[7 * i + 6] * src.rows;
            let rect = new cv.Rect(x1, y1, x2 - x1, y2 - y1);
            faces.push_back(rect);
        }
    }

    // Fit landmarks
    facemark.fit(src, faces, landmarks);

    // Process each face
    for (let i = 0; i < faces.size(); ++i) {
        let face = faces.get(i);
        let point1 = new cv.Point(face.x, face.y);
        let point2 = new cv.Point(face.x + face.width, face.y + face.height);
        cv.rectangle(src, point1, point2, [255, 0, 0, 255], 2); // Blue rectangle for face

        let landmark = landmarks.get(i);

        // Draw landmarks
        for (let j = 0; j < landmark.rows; j++) {
            let x = landmark.data32F[j * 2];
            let y = landmark.data32F[j * 2 + 1];
            cv.circle(src, new cv.Point(x, y), 2, [0, 255, 0, 255], -1);
        }

        // Calculate EAR for left eye (36-41)
        let leftEAR = eyeAspectRatio(landmark, 36, 37, 38, 39, 40, 41);
        let rightEAR = eyeAspectRatio(landmark, 42, 43, 44, 45, 46, 47);
        let ear = (leftEAR + rightEAR) / 2.0;
        if (ear < 0.25) {
            if (!lastBlink) {
                blinkCount++;
                blinkCountEl.innerText = blinkCount;
                lastBlink = true;
            }
        } else {
            lastBlink = false;
        }

        // MAR for mouth (48-67)
        let mar = mouthAspectRatio(landmark);
        if (mar > 0.5) {
            if (!lastMouthDetected) {
                mouthCount++;
                mouthCountEl.innerText = mouthCount;
                lastMouthDetected = true;
            }
        } else {
            lastMouthDetected = false;
        }

        // Eyebrow raise
        let leftEyebrowRaise = eyebrowRaise(landmark, 17, 18, 19, 20, 21, 36, 37, 38, 39, 40, 41);
        let rightEyebrowRaise = eyebrowRaise(landmark, 22, 23, 24, 25, 26, 42, 43, 44, 45, 46, 47);
        let eyebrowRaiseAvg = (leftEyebrowRaise + rightEyebrowRaise) / 2.0;
        if (eyebrowRaiseAvg < 0.3) {
            if (!lastEyebrowRaised) {
                eyebrowCount++;
                eyebrowCountEl.innerText = eyebrowCount;
                lastEyebrowRaised = true;
            }
        } else {
            lastEyebrowRaised = false;
        }
    }

    // Clean up
    blob.delete();
    detections.delete();
    landmarks.clear();
    faces.clear();

    cv.imshow('canvasOutput', src);

    requestAnimationFrame(processVideo);
}

window.onload = () => {
    if (typeof cv !== 'undefined' && cv.onRuntimeInitialized) {
        cv.onRuntimeInitialized = onOpenCvReady;
    } else {
        onOpenCvReady();
    }
};

function onOpenCvReady() {
    console.log("🟢 OpenCV está listo.");
    loadModelsAndStartApp();
}

function eyeAspectRatio(landmark, p1, p2, p3, p4, p5, p6) {
    let a = distance(landmark, p2, p6);
    let b = distance(landmark, p3, p5);
    let c = distance(landmark, p1, p4);
    return (a + b) / (2.0 * c);
}

function mouthAspectRatio(landmark) {
    let a = distance(landmark, 51, 57);
    let b = distance(landmark, 52, 56);
    let c = distance(landmark, 53, 55);
    let d = distance(landmark, 48, 54);
    return (a + b + c) / (2.0 * d);
}

function eyebrowRaise(landmark, b1, b2, b3, b4, b5, e1, e2, e3, e4, e5, e6) {
    let dists = [];
    for (let i = 0; i < 5; i++) {
        dists.push(distance(landmark, b1 + i, e1 + i));
    }
    return dists.reduce((a, b) => a + b, 0) / dists.length;
}

function distance(landmark, p1, p2) {
    let x1 = landmark.data32F[p1 * 2];
    let y1 = landmark.data32F[p1 * 2 + 1];
    let x2 = landmark.data32F[p2 * 2];
    let y2 = landmark.data32F[p2 * 2 + 1];
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}
