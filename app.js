// Footer info
fetch("config.json")
  .then(res => res.json())
  .then(d => {
    document.getElementById("footerInfo").innerText =
      `Desarrollado por ${d.autor} | GitHub: ${d.github} | Correo: ${d.correo}`;
  });

// Elementos
const video = document.getElementById("videoInput");
const canvas = document.getElementById("canvasOutput");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");

// Contadores
let blinkCount = 0;
let eyebrowCount = 0;
let mouthCount = 0;

const $blink = document.getElementById("blinkCount");
const $eyebrow = document.getElementById("eyebrowCount");
const $mouth = document.getElementById("mouthCount");

// Estados para evitar múltiples cuentas en un solo gesto
let state = { blink: false, mouth: false, brow: false };

// Umbrales (ajusta según tu cámara)
const TH = { BLINK: 0.015, MOUTH: 0.03, BROW: 0.1 };

// Inicializar cámara
navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  video.srcObject = stream;
  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    startFaceMesh();
  };
});

function startFaceMesh() {
  const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults(results => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(results.image,0,0,canvas.width,canvas.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length>0){
      const lm = results.multiFaceLandmarks[0];

      // Ojos (parpadeo)
      const leftEye = Math.hypot(lm[159].x - lm[145].x, lm[159].y - lm[145].y);
      const rightEye = Math.hypot(lm[386].x - lm[374].x, lm[386].y - lm[374].y);
      const eyeDist = (leftEye + rightEye)/2;

      if (eyeDist < TH.BLINK && !state.blink){ blinkCount++; $blink.textContent=blinkCount; state.blink=true; }
      if (eyeDist >= TH.BLINK) state.blink=false;

      // Boca (apertura)
      const mouth = Math.hypot(lm[13].x - lm[14].x, lm[13].y - lm[14].y);
      if (mouth > TH.MOUTH && !state.mouth){ mouthCount++; $mouth.textContent=mouthCount; state.mouth=true; }
      if (mouth <= TH.MOUTH) state.mouth=false;

      // Cejas (movimiento)
      const browL = lm[105].y - lm[159].y; // ceja izquierda vs ojo
      const browR = lm[334].y - lm[386].y; // ceja derecha vs ojo
      if ((browL < -TH.BROW || browR < -TH.BROW) && !state.brow){ eyebrowCount++; $eyebrow.textContent=eyebrowCount; state.brow=true; }
      if ((browL >= -TH.BROW && browR >= -TH.BROW)) state.brow=false;
    } else {
      status.textContent = "Buscando rostro...";
    }
  });

  const cameraMP = new Camera(video,{
    onFrame: async()=>{ await faceMesh.send({image:video}); },
    width:640,
    height:480
  });
  cameraMP.start();
  status.textContent = "Listo. Haz gestos frente a la cámara.";
}
