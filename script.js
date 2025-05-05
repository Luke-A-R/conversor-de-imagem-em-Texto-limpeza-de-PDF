// =============================================
// VARIÁVEIS GLOBAIS E CONFIGURAÇÃO INICIAL
// =============================================

// Variáveis globais
let uploadedFile = null;
let uploadedPdf = null;
let uploadedAudio = null;
let audioBlob = null;

// Configuração do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// =============================================
// ELEMENTOS DOM
// =============================================

const elements = {
    // Inputs
    imageInput: document.getElementById('imageInput'),
    pdfInput: document.getElementById('pdfInput'),
    audioInput: document.getElementById('audioInput'),
    
    // Previews
    preview: document.getElementById('preview'),
    pdfPreview: document.getElementById('pdfPreview'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    pdfPreviewContainer: document.getElementById('pdfPreviewContainer'),
    audioPreviewContainer: document.getElementById('audioPreviewContainer'),
    audioPreview: document.getElementById('audioPreview'),
    
    // Informações de arquivo
    audioFileName: document.getElementById('audioFileName'),
    audioFileSize: document.getElementById('audioFileSize'),
    audioDuration: document.getElementById('audioDuration'),
    
    // Processamento de PDF
    cleanPdfButton: document.getElementById('cleanPdfButton'),
    cleanMode: document.getElementById('cleanMode'),
    pdfProcessingMessage: document.getElementById('pdfProcessingMessage'),
    pdfProgress: document.getElementById('pdfProgress'),
    
    // Áreas de drag and drop
    dropArea: document.getElementById('dropArea'),
    pasteArea: document.getElementById('pasteArea'),
    
    // Extração de texto
    extractButton: document.getElementById('extractButton'),
    output: document.getElementById('output'),
    copyButton: document.getElementById('copyButton'),
    toggleDetailsButton: document.getElementById('toggleDetailsButton'),
    confidenceDetails: document.getElementById('confidenceDetails'),
    language: document.getElementById('language'),
    
    // Conversão de áudio
    convertButton: document.getElementById('convertButton'),
    audioResultContainer: document.getElementById('audioResultContainer'),
    convertedAudio: document.getElementById('convertedAudio'),
    downloadAudioButton: document.getElementById('downloadAudioButton'),
    
    // Ajuda
    helpButton: document.getElementById('helpButton'),
    helpModal: document.getElementById('helpModal'),
    closeButton: document.querySelector('.help-close-button')
};

// =============================================
// FUNÇÕES DE INICIALIZAÇÃO
// =============================================

// =============================================
// FUNÇÕES DE DRAG AND DROP E PASTE
// =============================================

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    unhighlightArea.call(e.currentTarget);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleDroppedFile(files[0]);
    }
}

function handleDroppedFile(file) {
    if (file.type.startsWith('image/')) {
        uploadedFile = file;
        uploadedPdf = null;
        uploadedAudio = null;
        showImagePreview(file);
    } else if (file.type === 'application/pdf') {
        uploadedPdf = file;
        uploadedFile = null;
        uploadedAudio = null;
        showPdfPreview(file);
    } else if (file.type.startsWith('audio/')) {
        uploadedAudio = file;
        uploadedFile = null;
        uploadedPdf = null;
        showAudioPreview(file);
    } else {
        showAlert('Tipo de arquivo não suportado. Por favor, use imagens, PDFs ou arquivos de áudio.');
    }
}

function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                uploadedFile = blob;
                uploadedPdf = null;
                uploadedAudio = null;
                showImagePreview(blob);
                break;
            }
        }
    }
}

function showImagePreview(file) {
    togglePreview('image');
    const reader = new FileReader();
    reader.onload = (e) => {
        elements.imagePreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function showPdfPreview(file) {
    togglePreview('pdf');
    const blobUrl = URL.createObjectURL(file);
    elements.pdfPreview.src = blobUrl;
}

function showAudioPreview(file) {
    togglePreview('audio');
    const blobUrl = URL.createObjectURL(file);
    elements.audioPreview.src = blobUrl;
    
    // Atualiza informações do arquivo
    elements.audioFileName.querySelector('span').textContent = file.name;
    elements.audioFileSize.querySelector('span').textContent = formatFileSize(file.size);
    
    // Carrega metadados para obter a duração
    elements.audioPreview.onloadedmetadata = () => {
        elements.audioDuration.querySelector('span').textContent = formatTime(elements.audioPreview.duration);
    };
}

// =============================================
// CONFIGURAÇÃO DE EVENT LISTENERS
// =============================================

function setupEventListeners() {
    // ... outros listeners ...
    
    // Configura drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        elements.dropArea.addEventListener(eventName, highlightArea, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        elements.dropArea.addEventListener(eventName, unhighlightArea, false);
    });
    
    elements.dropArea.addEventListener('drop', handleDrop, false);
    
    // Configura paste
    document.addEventListener('paste', handlePaste);
    
    // Garante que a área de paste seja clicável para focar no documento
    elements.pasteArea.addEventListener('click', () => {
        document.activeElement.blur();
        document.body.focus();
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlightArea() {
    this.classList.add('dragover');
}

function unhighlightArea() {
    this.classList.remove('dragover');
}

function init() {
    setupEventListeners();
}

function setupEventListeners() {
    // Upload de arquivos
    elements.imageInput.addEventListener('change', handleImageUpload);
    elements.pdfInput.addEventListener('change', handlePdfUpload);
    elements.audioInput.addEventListener('change', handleAudioUpload);
    
    // Botões de ação
    elements.cleanPdfButton.addEventListener('click', cleanAndDownloadPdf);
    elements.extractButton.addEventListener('click', extractText);
    elements.copyButton.addEventListener('click', copyText);
    elements.toggleDetailsButton.addEventListener('click', toggleDetails);
    elements.convertButton.addEventListener('click', convertToMp3);
    elements.downloadAudioButton.addEventListener('click', downloadMp3);
    
    // Drag and drop
    setupDragAndDropListeners();
    
    // Modal de ajuda
    setupHelpModalListeners();
}

function setupDragAndDropListeners() {
    const events = ['dragenter', 'dragover', 'dragleave', 'drop'];
    
    events.forEach(eventName => {
        elements.dropArea.addEventListener(eventName, preventDefaults, false);
        elements.pasteArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        elements.dropArea.addEventListener(eventName, highlightArea, false);
        elements.pasteArea.addEventListener(eventName, highlightArea, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        elements.dropArea.addEventListener(eventName, unhighlightArea, false);
        elements.pasteArea.addEventListener(eventName, unhighlightArea, false);
    });
    
    elements.dropArea.addEventListener('drop', handleDrop, false);
    document.addEventListener('paste', handlePaste);
}

function setupHelpModalListeners() {
    elements.helpButton.addEventListener('click', () => {
        elements.helpModal.style.display = 'block';
    });
    
    elements.closeButton.addEventListener('click', () => {
        elements.helpModal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === elements.helpModal) {
            elements.helpModal.style.display = 'none';
        }
    });
}

// =============================================
// FUNÇÕES DE MANIPULAÇÃO DE ARQUIVOS
// =============================================

// Funções de upload
async function handleImageUpload(event) {
    uploadedFile = event.target.files[0];
    uploadedPdf = null;
    uploadedAudio = null;
    
    if (uploadedFile) {
        togglePreview('image');
        const reader = new FileReader();
        reader.onload = (e) => {
            elements.imagePreview.src = e.target.result;
            elements.preview.style.display = 'block';
        };
        reader.readAsDataURL(uploadedFile);
    }
}

async function handlePdfUpload(event) {
    uploadedPdf = event.target.files[0];
    uploadedFile = null;
    uploadedAudio = null;
    
    if (uploadedPdf) {
        togglePreview('pdf');
        const blobUrl = URL.createObjectURL(uploadedPdf);
        elements.pdfPreview.src = blobUrl;
    }
}

async function handleAudioUpload(event) {
    uploadedAudio = event.target.files[0];
    uploadedFile = null;
    uploadedPdf = null;
    
    if (uploadedAudio) {
        togglePreview('audio');
        const blobUrl = URL.createObjectURL(uploadedAudio);
        elements.audioPreview.src = blobUrl;
        
        elements.audioFileName.textContent = `Nome: ${uploadedAudio.name}`;
        elements.audioFileSize.textContent = `Tamanho: ${formatFileSize(uploadedAudio.size)}`;
        
        elements.audioPreview.onloadedmetadata = () => {
            elements.audioDuration.textContent = `Duração: ${formatTime(elements.audioPreview.duration)}`;
        };
    }
}

// Funções de visualização
function togglePreview(type) {
    elements.pdfPreviewContainer.classList.toggle('hidden', type !== 'pdf');
    elements.imagePreviewContainer.classList.toggle('hidden', type !== 'image');
    elements.audioPreviewContainer.classList.toggle('hidden', type !== 'audio');
    document.getElementById('playConverted').classList.toggle('hidden', type !== 'audio');
}

// Funções de formatação
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// =============================================
// FUNÇÕES DE PROCESSAMENTO DE PDF
// =============================================

async function cleanAndDownloadPdf() {
    if (!uploadedPdf) {
        showAlert('Por favor, carregue um PDF primeiro.');
        return;
    }

    try {
        setProcessingState(true);
        updateProgress(10);

        if (uploadedPdf.type !== 'application/pdf') {
            throw new Error('O arquivo não é um PDF válido');
        }

        updateProgress(20);
        const arrayBuffer = await readFileAsArrayBuffer(uploadedPdf);
        updateProgress(30);

        const cleanedPdfBytes = await processPdf(arrayBuffer);
        updateProgress(80);

        downloadPdf(cleanedPdfBytes);
        updateProgress(100);

    } catch (error) {
        handleError('Erro ao processar PDF:', error);
    } finally {
        setProcessingState(false);
    }
}

async function processPdf(arrayBuffer) {
    const cleanMode = elements.cleanMode.value;
    
    switch(cleanMode) {
        case 'basic':
            return await basicCleanPdf(arrayBuffer);
        case 'deep':
            return await deepCleanPdf(arrayBuffer);
        case 'render':
            return await renderCleanPdf(uploadedPdf);
        default:
            throw new Error('Modo de limpeza inválido');
    }
}

async function basicCleanPdf(arrayBuffer) {
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    
    // Limpeza básica de metadados
    pdfDoc.setTitle('Documento Limpo');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');
    
    try {
        pdfDoc.setCreationDate(new Date(0));
        pdfDoc.setModificationDate(new Date(0));
    } catch (e) {
        console.warn('Não foi possível remover datas', e);
    }
    
    return await pdfDoc.save();
}

async function deepCleanPdf(arrayBuffer) {
    const basicCleaned = await basicCleanPdf(arrayBuffer);
    const pdfDoc = await PDFLib.PDFDocument.load(basicCleaned);
    
    if (pdfDoc.catalog.get(PDFLib.Name.of('AcroForm'))) {
        pdfDoc.catalog.delete(PDFLib.Name.of('AcroForm'));
    }
    
    const pages = pdfDoc.getPages();
    for (const page of pages) {
        try {
            page.node.removeAnnots();
            if (page.node.get(PDFLib.Name.of('AA'))) {
                page.node.delete(PDFLib.Name.of('AA'));
            }
        } catch (e) {
            console.warn('Erro ao limpar página', e);
        }
    }
    
    return await pdfDoc.save();
}

async function renderCleanPdf(pdfFile) {
    const loadingTask = pdfjsLib.getDocument(await pdfFile.arrayBuffer());
    const pdf = await loadingTask.promise;
    const { PDFDocument } = PDFLib;
    const newPdfDoc = await PDFDocument.create();

    const dpi = 300;                      // Define a qualidade (300 DPI é bom para impressão)
    const scale = dpi / 72;              // 72 é o padrão base do PDF.js

    for (let i = 1; i <= pdf.numPages; i++) {
        updateProgress(30 + (i * 50 / pdf.numPages));
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;

        // Usa Blob para melhor qualidade do PNG
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const arrayBuffer = await blob.arrayBuffer();

        const image = await newPdfDoc.embedPng(arrayBuffer);
        const newPage = newPdfDoc.addPage([image.width, image.height]);

        newPage.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height
        });
    }

    newPdfDoc.setTitle('Documento Renderizado');
    newPdfDoc.setAuthor('');

    return await newPdfDoc.save();
}


// Funções auxiliares de PDF
function downloadPdf(pdfBytes) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const fileName = `documento_limpo_${elements.cleanMode.value}.pdf`;
    saveAs(blob, fileName);
}

function setProcessingState(isProcessing) {
    elements.cleanPdfButton.disabled = isProcessing;
    elements.pdfProcessingMessage.classList.toggle('hidden', !isProcessing);
}

function updateProgress(percent) {
    elements.pdfProgress.style.width = `${percent}%`;
    elements.pdfProgress.textContent = `${percent}%`;
}

// =============================================
// FUNÇÕES DE CONVERSÃO DE ÁUDIO
// =============================================

async function convertToMp3() {
    if (!uploadedAudio) {
        showAlert('Por favor, carregue um arquivo de áudio primeiro.');
        return;
    }

    try {
        showAlert('Convertendo para MP3...');
        
        if (!window.lamejs) {
            throw new Error('Biblioteca de codificação MP3 não carregada');
        }
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        
        const arrayBuffer = await uploadedAudio.arrayBuffer();
        let audioBuffer;
        
        try {
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            throw new Error('Formato de áudio não suportado ou arquivo corrompido');
        }
        
        const bitrate = parseInt(document.getElementById('bitrate').value) || 128;
        const sampleRate = Math.min(44100, audioBuffer.sampleRate);
        const channels = audioBuffer.numberOfChannels;
        
        const mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);
        
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
        
        const samples = new Int16Array(leftChannel.length * channels);
        for (let i = 0, j = 0; i < leftChannel.length; i++) {
            samples[j++] = leftChannel[i] * 32767;
            if (channels > 1) {
                samples[j++] = rightChannel[i] * 32767;
            }
        }
        
        const chunkSize = 1152;
        const mp3Data = [];
        
        for (let i = 0; i < samples.length; i += chunkSize * channels) {
            const chunk = samples.subarray(i, i + chunkSize * channels);
            const mp3buf = mp3Encoder.encodeBuffer(chunk);
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }
        
        const finalMP3 = mp3Encoder.flush();
        if (finalMP3.length > 0) {
            mp3Data.push(finalMP3);
        }
        
        audioBlob = new Blob(mp3Data, { type: 'audio/mp3' });
        const audioURL = URL.createObjectURL(audioBlob);
        elements.convertedAudio.src = audioURL;
        
        elements.convertedAudio.oncanplaythrough = () => {
            document.getElementById('playConverted').onclick = () => {
                elements.convertedAudio.play().catch(e => {
                    console.error("Erro ao reproduzir:", e);
                    showAlert("Erro ao reproduzir. Clique novamente para tentar.");
                });
            };
        };
        
        elements.audioResultContainer.classList.remove('hidden');
        showAlert('Conversão concluída com sucesso! Clique no botão "Reproduzir" para ouvir.');
        
    } catch (error) {
        handleError('Erro ao converter áudio:', error);
        showAlert(`Falha na conversão: ${error.message}`);
    }
}

function downloadMp3() {
    if (!audioBlob) {
        showAlert('Nenhum arquivo MP3 disponível para download.');
        return;
    }
    
    const fileName = uploadedAudio.name.replace(/\.[^/.]+$/, "") + '.mp3';
    saveAs(audioBlob, fileName);
}

// =============================================
// FUNÇÕES DE EXTRAÇÃO DE TEXTO
// =============================================

function extractText() {
    if (!uploadedFile && !uploadedPdf) {
        showAlert('Por favor, carregue uma imagem ou PDF.');
        return;
    }

    if (uploadedPdf) {
        showAlert('Para extrair texto de PDFs, por favor carregue uma imagem.');
        return;
    }

    prepareTextExtraction();
    
    Tesseract.recognize(
        uploadedFile,
        elements.language.value,
        { logger: m => console.log(m) }
    ).then(handleRecognitionResult)
     .catch(handleRecognitionError);
}

function prepareTextExtraction() {
    elements.output.innerText = 'Processando...';
    elements.confidenceDetails.innerHTML = '';
    elements.toggleDetailsButton.classList.add('hidden');
    elements.copyButton.classList.add('hidden');
}

function handleRecognitionResult({ data: { text, words } }) {
    elements.output.innerText = text;
    elements.confidenceDetails.innerHTML = words.map(word => `
        <div><strong>${word.text}</strong>: ${(word.confidence * 100).toFixed(2)}% de confiança</div>
    `).join('');
    
    elements.toggleDetailsButton.classList.remove('hidden');
    elements.copyButton.classList.remove('hidden');
}

function handleRecognitionError(err) {
    console.error(err);
    elements.output.innerText = 'Erro ao processar a imagem.';
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

// Funções de manipulação de arquivos
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function mergeArrays(arrays) {
    let totalLength = 0;
    for (const arr of arrays) {
        totalLength += arr.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// Funções de UI
function copyText() {
    navigator.clipboard.writeText(elements.output.innerText)
        .then(() => showAlert('Texto copiado para a área de transferência!'))
        .catch(err => console.error('Erro ao copiar o texto:', err));
}

function toggleDetails() {
    const isHidden = elements.confidenceDetails.style.display === 'none';
    elements.confidenceDetails.style.display = isHidden ? 'block' : 'none';
    elements.toggleDetailsButton.innerText = isHidden ? 'Ocultar Detalhes' : 'Mostrar Detalhes';
}

function showAlert(message) {
    alert(message);
}

function handleError(context, error) {
    console.error(context, error);
    showAlert(`Erro: ${error.message}`);
}

// =============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =============================================

init();
