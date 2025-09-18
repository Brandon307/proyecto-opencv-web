document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const blinkCount = document.getElementById('blink-count');
    const eyebrowCount = document.getElementById('eyebrow-count');
    const mouthCount = document.getElementById('mouth-count');
    const statusElement = document.getElementById('status');
    
    let isDetecting = false;
    let detectionInterval;
    
    // Inicializar OpenCV
    function onOpenCvReady() {
        statusElement.textContent = 'OpenCV.js está listo. Haz clic en Iniciar Detección.';
        startBtn.disabled = false;
    }
    
    // Verificar si OpenCV está cargado
    if (typeof cv !== 'undefined') {
        onOpenCvReady();
    } else {
        document.addEventListener('opencvready', onOpenCvReady);
    }
    
    // Iniciar o detener la detección
    startBtn.addEventListener('click', function() {
        if (!isDetecting) {
            startDetection();
            startBtn.textContent = 'Detener Detección';
            startBtn.classList.remove('btn-success');
            startBtn.classList.add('btn-warning');
        } else {
            stopDetection();
            startBtn.textContent = 'Iniciar Detección';
            startBtn.classList.remove('btn-warning');
            startBtn.classList.add('btn-success');
        }
        isDetecting = !isDetecting;
    });
    
    // Reiniciar contadores
    resetBtn.addEventListener('click', function() {
        blinkCount.textContent = '0';
        eyebrowCount.textContent = '0';
        mouthCount.textContent = '0';
        resetCounters();
    });
    
    // Iniciar la detección facial
    function startDetection() {
        statusElement.textContent = 'Iniciando cámara...';
        
        // Solicitar acceso a la cámara
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(stream) {
                const video = document.getElementById('video');
                video.srcObject = stream;
                
                statusElement.textContent = 'Cámara activa. Iniciando detección...';
                
                // Iniciar el proceso de detección
                detectionInterval = setInterval(function() {
                    processVideo(video);
                }, 100); // Procesar 10 veces por segundo
            })
            .catch(function(err) {
                statusElement.textContent = 'Error al acceder a la cámara: ' + err.message;
                console.error('Error al acceder a la cámara:', err);
            });
    }
    
    // Detener la detección
    function stopDetection() {
        clearInterval(detectionInterval);
        
        const video = document.getElementById('video');
        if (video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            video.srcObject = null;
        }
        
        statusElement.textContent = 'Detección detenida.';
    }
    
    // Actualizar contadores (esta función será llamada desde face-detection.js)
    window.updateCounters = function(blinks, eyebrows, mouth) {
        blinkCount.textContent = blinks;
        eyebrowCount.textContent = eyebrows;
        mouthCount.textContent = mouth;
    };
});