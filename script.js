// Variáveis globais
let uploadedFile = null;
let uploadedPdf = null;

// Configuração inicial
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// Elementos DOM
const elements = {
    imageInput: document.getElementById('imageInput'),
    pdfInput: document.getElementById('pdfInput'),
    preview: document.getElementById('preview'),
    pdfPreview: document.getElementById('pdfPreview'),
    cleanPdfButton: document.getElementById('cleanPdfButton'),
    cleanMode: document.getElementById('cleanMode'),
    pdfProcessingMessage: document.getElementById('pdfProcessingMessage'),
    pdfProgress: document.getElementById('pdfProgress'),
    dropArea: document.getElementById('dropArea'),
    pasteArea: document.getElementById('pasteArea'),
    extractButton: document.getElementById('extractButton'),
    output: document.getElementById('output'),
    copyButton: document.getElementById('copyButton'),
    toggleDetailsButton: document.getElementById('toggleDetailsButton'),
    confidenceDetails: document.getElementById('confidenceDetails'),
    language: document.getElementById('language'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    pdfPreviewContainer: document.getElementById('pdfPreviewContainer'),
    helpButton: document.getElementById('helpButton'),
    helpModal: document.getElementById('helpModal'),
    closeButton: document.querySelector('.help-close-button')
};

// Inicialização
function init() {
    setupEventListeners();
}

// Configuração de event listeners
function setupEventListeners() {
    // Upload de arquivos
    elements.imageInput.addEventListener('change', handleImageUpload);
    elements.pdfInput.addEventListener('change', handlePdfUpload);
    
    // Botões principais
    elements.cleanPdfButton.addEventListener('click', cleanAndDownloadPdf);
    elements.extractButton.addEventListener('click', extractText);
    elements.copyButton.addEventListener('click', copyText);
    elements.toggleDetailsButton.addEventListener('click', toggleDetails);
    
    // Drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
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
    
    // Ajuda
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

// Funções de manipulação de arquivos
async function handleImageUpload(event) {
    uploadedFile = event.target.files[0];
    uploadedPdf = null;
    
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
    
    if (uploadedPdf) {
        togglePreview('pdf');
        const blobUrl = URL.createObjectURL(uploadedPdf);
        elements.pdfPreview.src = blobUrl;
    }
}

function togglePreview(type) {
    elements.pdfPreviewContainer.classList.toggle('hidden', type !== 'pdf');
    elements.imagePreviewContainer.classList.toggle('hidden', type !== 'image');
}

// Funções de PDF
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
    
    for (let i = 1; i <= pdf.numPages; i++) {
        updateProgress(30 + (i * 50 / pdf.numPages));
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        const image = await newPdfDoc.embedPng(canvas.toDataURL('image/png'));
        const newPage = newPdfDoc.addPage([image.width, image.height]);
        newPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    
    newPdfDoc.setTitle('Documento Renderizado');
    newPdfDoc.setAuthor('');
    
    return await newPdfDoc.save();
}

// Funções de utilidade
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

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Funções de drag and drop
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

function handleDrop(e) {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    if (file.type.startsWith('image/')) {
        handleDroppedFile(file, 'image');
    } else if (file.type === 'application/pdf') {
        handleDroppedFile(file, 'pdf');
    }
}

function handleDroppedFile(file, type) {
    if (type === 'image') {
        uploadedFile = file;
        uploadedPdf = null;
    } else {
        uploadedPdf = file;
        uploadedFile = null;
    }
    
    togglePreview(type);
    
    if (type === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => elements.imagePreview.src = e.target.result;
        reader.readAsDataURL(file);
    } else {
        elements.pdfPreview.src = URL.createObjectURL(file);
    }
}

function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            uploadedFile = blob;
            uploadedPdf = null;
            
            togglePreview('image');
            
            const reader = new FileReader();
            reader.onload = (event) => elements.imagePreview.src = event.target.result;
            reader.readAsDataURL(blob);
            break;
        }
    }
}

// Funções de extração de texto
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

// Funções auxiliares
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

// Inicializar a aplicação
init();
