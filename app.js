let video = document.getElementById("videoInput");
let canvas = document.getElementById("canvasOutput");
let ctx = canvas.getContext("2d");

let blinkCount = 0;
let eyebrowCount = 0;
let mouthCount = 0;

let faceCascade, eyeCascade, mouthCascade;
let src, gray, cap;

async function loadCascade(name, file) {
  let response = await fetch(file);
  let data = new Uint8Array(await response.arrayBuffer());
  cv.FS_createDataFile("/", name, data, true, false, false);
  let classifier = new cv.CascadeClassifier();
  classifier.load(name);
  return classifier;
}

async function loadClassifiers() {
  faceCascade = await loadCascade("haarcascade_frontalface_default.xml", "assets/haarcascade_frontalface_default.xml");
  eyeCascade = await loadCascade("haarcascade_eye.xml", "assets/haarcascade_eye.xml");
  mouthCascade = await loadCascade("haarcascade_mcs_mouth.xml", "assets/haarcascade_mcs_mouth.xml");
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then((stream) => {
      video.srcObject = stream;
      video.play();
      document.getElementById("status").innerText = "Cámara iniciada ✅";
    })
    .catch((err) => {
      document.getElementById("status").innerText = "Error al iniciar cámara: " + err;
    });
}

function processVideo() {
  cap = new cv.VideoCapture(video);
  src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
  gray = new cv.Mat();

  const FPS = 15;
  function loop() {
    cap.read(src);
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    let faces = new cv.RectVector();
    faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0);

    for (let i = 0; i < faces.size(); ++i) {
      let face = faces.get(i);
      let roiGray = gray.roi(face);

      // Detectar ojos
      let eyes = new cv.RectVector();
      eyeCascade.detectMultiScale(roiGray, eyes);

      if (eyes.size() < 2) {
        blinkCount++;
        document.getElementById("blinkCount").innerText = blinkCount;
      }

      // Detectar boca
      let mouths = new cv.RectVector();
      mouthCascade.detectMultiScale(roiGray, mouths, 1.3, 5);

      if (mouths.size() > 0) {
        mouthCount++;
        document.getElementById("mouthCount").innerText = mouthCount;
      }

      // Dibujar rectángulo en la cara
      cv.rectangle(src, new cv.Point(face.x, face.y),
        new cv.Point(face.x + face.width, face.y + face.height),
        [0, 255, 0, 255], 2);

      roiGray.delete();
      eyes.delete();
      mouths.delete();
    }

    cv.imshow("canvasOutput", src);
    setTimeout(loop, 1000 / FPS);

    faces.delete();
  }
  loop();
}

cv['onRuntimeInitialized'] = async () => {
  document.getElementById("status").innerText = "Cargando clasificadores...";
  await loadClassifiers();
  startCamera();
  setTimeout(processVideo, 1500);
};
