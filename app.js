let video = document.getElementById('videoInput');
let canvas = document.getElementById('canvasOutput');
let ctx = canvas.getContext('2d');
let statusEl = document.getElementById('status');
let blinkCountEl = document.getElementById('blinkCount');
let eyebrowCountEl = document.getElementById('eyebrowCount');
let mouthCountEl = document = document.getElementById('mouthCount');

let faceCascade, eyeCascade, mouthCascade;
let streaming = false;
let src, gray, faces, eyes, mouths, cap;

let blinkCount = 0;
let lastEyesDetected = 2;
let lastBlink = false;

let mouthCount = 0;
let lastMouthDetected = false;

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

    faceCascade = new cv.CascadeClassifier();
    eyeCascade = new cv.CascadeClassifier();
    mouthCascade = new cv.CascadeClassifier();

    const faceCascadeFile = 'haar/haarcascade_frontalface_default.xml';
    const eyeCascadeFile = 'haar/haarcascade_eye.xml';
    const mouthCascadeFile = 'haar/haarcascade_mcs_mouth.xml';

    Promise.all([
        fetch(faceCascadeFile).then(response => response.arrayBuffer()),
        fetch(eyeCascadeFile).then(response => response.arrayBuffer()),
        fetch(mouthCascadeFile).then(response => response.arrayBuffer())
    ]).then(buffers => {
        clearTimeout(loadTimeout);
        console.log("🟢 Modelos cargados exitosamente.");

        cv.FS_createDataFile('/', 'face.xml', new Uint8Array(buffers[0]), true, false, false);
        cv.FS_createDataFile('/', 'eye.xml', new Uint8Array(buffers[1]), true, false, false);
        cv.FS_createDataFile('/', 'mouth.xml', new Uint8Array(buffers[2]), true, false, false);

        faceCascade.load('face.xml');
        eyeCascade.load('eye.xml');
        mouthCascade.load('mouth.xml');

        src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
        gray = new cv.Mat();
        faces = new cv.RectVector();
        eyes = new cv.RectVector();
        mouths = new cv.RectVector();
        
        statusEl.innerText = "✅ Modelos cargados. Iniciando cámara...";
        startCamera();
    }).catch(error => {
        clearTimeout(loadTimeout);
        console.error("❌ Error al cargar los archivos XML:", error);
        if (loadAttempt < MAX_LOAD_ATTEMPTS) {
            console.warn("⚠️ Fallo en la carga. Reintentando...");
            loadModelsAndStartApp();
        } else {
            statusEl.innerText = "❌ Fallo en la carga. Intenta recargar la página.";
        }
    });
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

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    faceCascade.detectMultiScale(gray, faces, 1.5, 3, 0, new cv.Size(50, 50), new cv.Size(0, 0));

    // Dibujar los rectángulos de la cara
    for (let i = 0; i < faces.size(); ++i) {
        let face = faces.get(i);
        let point1 = new cv.Point(face.x, face.y);
        let point2 = new cv.Point(face.x + face.width, face.y + face.height);
       // cv.rectangle(src, point1, point2, [255, 0, 0, 255], 2); // Rectángulo azul para la cara

        let roiGray = gray.roi(face);
        
        // Detección de Ojos
        eyeCascade.detectMultiScale(roiGray, eyes, 1.1, 3, 0, new cv.Size(0, 0), new cv.Size(0, 0));
        
        for (let j = 0; j < eyes.size(); ++j) {
            let eye = eyes.get(j);
            let eyePoint1 = new cv.Point(face.x + eye.x, face.y + eye.y);
            let eyePoint2 = new cv.Point(face.x + eye.x + eye.width, face.y + eye.y + eye.height);
            cv.rectangle(src, eyePoint1, eyePoint2, [0, 255, 0, 255], 2); // Rectángulo verde para los ojos
        }

        if (eyes.size() < lastEyesDetected) {
            if (!lastBlink) {
                blinkCount++;
                blinkCountEl.innerText = blinkCount;
            }
            lastBlink = true;
        } else {
            lastBlink = false;
        }
        lastEyesDetected = eyes.size();

        // Detección de Boca
        let mouthRect = new cv.Rect(face.x, face.y + face.height / 2, face.width, face.height / 2);
        let roiMouth = gray.roi(mouthRect);

        mouthCascade.detectMultiScale(roiMouth, mouths, 1.8, 2, 0, new cv.Size(0, 0), new cv.Size(0, 0));
        
        for (let k = 0; k < mouths.size(); ++k) {
            let mouth = mouths.get(k);
            let mouthPoint1 = new cv.Point(face.x + mouthRect.x + mouth.x, face.y + mouthRect.y + mouth.y);
            let mouthPoint2 = new cv.Point(face.x + mouthRect.x + mouth.x + mouth.width, face.y + mouthRect.y + mouth.y + mouth.height);
            cv.rectangle(src, mouthPoint1, mouthPoint2, [1, 5, 255, 255], 2); // Rectángulo rojo para la boca
        }
        
        if (mouths.size() > 0) {
            if (!lastMouthDetected) {
                mouthCount++;
                mouthCountEl.innerText = mouthCount;
            }
            lastMouthDetected = true;
        } else {
            lastMouthDetected = false;
        }

        eyebrowCountEl.innerText = "N/A"; // Detección de cejas no es viable con este método

        roiGray.delete();
        roiMouth.delete();
    }
    
    // Convertir la matriz de OpenCV de vuelta al canvas
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