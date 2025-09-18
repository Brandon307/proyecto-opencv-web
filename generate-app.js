const fs = require('fs');
const files = [
    { path: './haar/haarcascade_frontalface_default.xml', varName: 'faceCascadeBase64' },
    { path: './haar/haarcascade_eye.xml', varName: 'eyeCascadeBase64' },
    { path: './haar/haarcascade_mcs_mouth.xml', varName: 'mouthCascadeBase64' }
];

let base64Strings = {};

console.log('Generando cadenas Base64...');

files.forEach(file => {
    try {
        const data = fs.readFileSync(file.path);
        base64Strings[file.varName] = data.toString('base64');
        console.log(`✅ ${file.path} - OK`);
    } catch (error) {
        console.error(`❌ Error al leer ${file.path}:`, error);
    }
});

const appTemplate = `
// Contenido de los modelos Haar Cascade codificados en Base64.
// Este archivo fue generado automáticamente.
const faceCascadeBase64 = \`\${faceBase64}\`;
const eyeCascadeBase64 = \`\${eyeBase64}\`;
const mouthCascadeBase64 = \`\${mouthBase64}\`;

// --- NO TOCAR NADA DE AQUÍ EN ADELANTE ---

let video = document.getElementById('videoInput');
let canvas = document.getElementById('canvasOutput');
let ctx = canvas.getContext('2d');
let statusEl = document.getElementById('status');
let blinkCountEl = document.getElementById('blinkCount');
let eyebrowCountEl = document.getElementById('eyebrowCount');
let mouthCountEl = document.getElementById('mouthCount');

let streaming = false;
let blinkCount = 0;
let lastEyesDetected = 2; // Estado para el parpadeo
let mouthCount = 0;
let lastMouthOpen = false;

let faceCascade, eyeCascade, mouthCascade;
let src, gray, cap;

function base64ToBytes(base64) {
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8Array(new ArrayBuffer(rawLength));
    for(var i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

async function loadModelsAndStartApp() {
    statusEl.innerText = "✅ Cargando modelos desde el código...";
    
    try {
        faceCascade = new cv.CascadeClassifier();
        eyeCascade = new cv.CascadeClassifier();
        mouthCascade = new cv.CascadeClassifier();

        let faceBytes = base64ToBytes(faceCascadeBase64);
        let eyeBytes = base64ToBytes(eyeCascadeBase64);
        let mouthBytes = base64ToBytes(mouthCascadeBase64);
        
        cv.FS_createDataFile('/', 'face.xml', faceBytes, true, false, false);
        cv.FS_createDataFile('/', 'eye.xml', eyeBytes, true, false, false);
        cv.FS_createDataFile('/', 'mouth.xml', mouthBytes, true, false, false);
        
        faceCascade.load('face.xml');
        eyeCascade.load('eye.xml');
        mouthCascade.load('mouth.xml');

        src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
        gray = new cv.Mat();
        
        statusEl.innerText = "✅ Modelos cargados. Iniciando cámara...";
        startCamera();
    } catch (error) {
        console.error("❌ Error al cargar los modelos:", error);
        statusEl.innerText = "❌ Fallo en la carga de modelos. Revisa la consola.";
    }
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
    if (!streaming) return;
    
    cap.read(src);
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    let faces = new cv.RectVector();
    let eyes = new cv.RectVector();
    let mouths = new cv.RectVector();
    
    faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0, new cv.Size(0, 0), new cv.Size(0, 0));

    for (let i = 0; i < faces.size(); ++i) {
        let face = faces.get(i);
        let point1 = new cv.Point(face.x, face.y);
        let point2 = new cv.Point(face.x + face.width, face.y + face.height);
        cv.rectangle(src, point1, point2, [255, 0, 0, 255], 2);

        let roiGray = gray.roi(face);
        
        eyeCascade.detectMultiScale(roiGray, eyes, 1.1, 3, 0, new cv.Size(0, 0), new cv.Size(0, 0));
        
        for (let j = 0; j < eyes.size(); ++j) {
            let eye = eyes.get(j);
            let eyePoint1 = new cv.Point(face.x + eye.x, face.y + eye.y);
            let eyePoint2 = new cv.Point(face.x + eye.x + eye.width, face.y + eye.y + eye.height);
            cv.rectangle(src, eyePoint1, eyePoint2, [0, 255, 0, 255], 2);
        }

        if (eyes.size() < 2 && lastEyesDetected >= 2) {
            blinkCount++;
            blinkCountEl.innerText = blinkCount;
        }
        lastEyesDetected = eyes.size();

        let mouthRect = new cv.Rect(face.x, face.y + face.height / 2, face.width, face.height / 2);
        let roiMouth = gray.roi(mouthRect);

        mouthCascade.detectMultiScale(roiMouth, mouths, 1.1, 3, 0, new cv.Size(0, 0), new cv.Size(0, 0));
        
        for (let k = 0; k < mouths.size(); ++k) {
            let mouth = mouths.get(k);
            let mouthPoint1 = new cv.Point(face.x + mouthRect.x + mouth.x, face.y + mouthRect.y + mouth.y);
            let mouthPoint2 = new cv.Point(face.x + mouthRect.x + mouth.x + mouth.width, face.y + mouthRect.y + mouth.y + mouth.height);
            cv.rectangle(src, mouthPoint1, mouthPoint2, [0, 0, 255, 255], 2);
        }
        
        if (mouths.size() > 0 && !lastMouthOpen) {
            mouthCount++;
            mouthCountEl.innerText = mouthCount;
        }
        lastMouthOpen = mouths.size() > 0;

        eyebrowCountEl.innerText = "N/A";

        roiGray.delete();
        roiMouth.delete();
    }

    faces.delete();
    eyes.delete();
    mouths.delete();
    
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
`;

const finalCode = appTemplate
    .replace('faceBase64', base64Strings.faceCascadeBase64)
    .replace('eyeBase64', base64Strings.eyeCascadeBase64)
    .replace('mouthBase64', base64Strings.mouthCascadeBase64);

fs.writeFileSync('app.js', finalCode);
console.log('✅ Archivo app.js generado exitosamente. ¡Listo para usar!');