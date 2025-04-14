let uploadedFile = null;
let uploadedPdf = null;

// Configuração do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// Elementos DOM
const elements = {
    imageInput: document.getElementById('imageInput'),
    pdfInput: document.getElementById('pdfInput'),
    preview: document.getElementById('preview'),
    pdfPreview: document.getElementById('pdfPreview'),
    pdfViewer: document.getElementById('pdfViewer'),
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
    pdfPreview: document.getElementById('pdfPreview')
};

// Event Listeners
elements.imageInput.addEventListener('change', handleImageUpload);
elements.pdfInput.addEventListener('change', handlePdfUpload);
elements.cleanPdfButton.addEventListener('click', cleanAndDownloadPdf);
elements.extractButton.addEventListener('click', extractText);
elements.copyButton.addEventListener('click', copyText);
elements.toggleDetailsButton.addEventListener('click', toggleDetails);

// Configuração de arrastar e soltar
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

// Funções principais
function handleImageUpload(event) {
    uploadedFile = event.target.files[0];
    uploadedPdf = null;
    
    if (uploadedFile) {
        // Mostrar pré-visualização da imagem
        elements.pdfPreviewContainer.classList.add('hidden');
        elements.imagePreviewContainer.classList.remove('hidden');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            elements.imagePreview.src = e.target.result;
            elements.preview.style.display = 'block';
        };
        reader.readAsDataURL(uploadedFile);
    }
}
function handlePdfUpload(event) {
    uploadedPdf = event.target.files[0];
    uploadedFile = null;
    
    if (uploadedPdf) {
        // Mostrar visualização do PDF
        elements.imagePreviewContainer.classList.add('hidden');
        elements.pdfPreviewContainer.classList.remove('hidden');
        
        const blobUrl = URL.createObjectURL(uploadedPdf);
        elements.pdfPreview.src = blobUrl;
    }
}

async function cleanAndDownloadPdf() {
    if (!uploadedPdf) {
        alert('Por favor, carregue um PDF primeiro.');
        return;
    }

    try {
        // Configuração do estado inicial
        elements.cleanPdfButton.disabled = true;
        elements.pdfProcessingMessage.classList.remove('hidden');
        updateProgress(10);

        // Verificar se é um PDF válido
        if (uploadedPdf.type !== 'application/pdf') {
            throw new Error('O arquivo não é um PDF válido');
        }

        updateProgress(20);
        const arrayBuffer = await readFileAsArrayBuffer(uploadedPdf);
        updateProgress(30);

        // Obter o modo de limpeza selecionado
        const cleanMode = elements.cleanMode.value;
        let cleanedPdfBytes;

        // Executar o modo de limpeza selecionado
        switch(cleanMode) {
            case 'basic':
                cleanedPdfBytes = await basicCleanPdf(arrayBuffer);
                break;
            case 'deep':
                cleanedPdfBytes = await deepCleanPdf(arrayBuffer);
                break;
            case 'render':
                cleanedPdfBytes = await renderCleanPdf(uploadedPdf);
                break;
            default:
                throw new Error('Modo de limpeza inválido');
        }

        updateProgress(80);

        // Criar e baixar o PDF limpo
        const blob = new Blob([cleanedPdfBytes], { type: 'application/pdf' });
        const fileName = `documento_limpo_${cleanMode}.pdf`;
        saveAs(blob, fileName);
        updateProgress(100);

    } catch (error) {
        console.error('Erro ao processar PDF:', error);
        alert(`Erro: ${error.message}`);
    } finally {
        elements.cleanPdfButton.disabled = false;
        elements.pdfProcessingMessage.classList.add('hidden');
    }
}

// Funções de limpeza de PDF
async function basicCleanPdf(arrayBuffer) {
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    
    // Remover metadados básicos
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
    // Primeiro fazer uma limpeza básica
    const basicCleaned = await basicCleanPdf(arrayBuffer);
    
    // Carregar novamente para limpeza profunda
    const pdfDoc = await PDFLib.PDFDocument.load(basicCleaned);
    
    // Remover assinaturas digitais e campos de formulário
    if (pdfDoc.catalog.get(PDFLib.Name.of('AcroForm'))) {
        pdfDoc.catalog.delete(PDFLib.Name.of('AcroForm'));
    }
    
    // Remover anotações e ações
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
    // Carregar o PDF com pdf.js
    const loadingTask = pdfjsLib.getDocument(await pdfFile.arrayBuffer());
    const pdf = await loadingTask.promise;
    const { PDFDocument } = PDFLib;
    const newPdfDoc = await PDFDocument.create();
    
    // Processar cada página
    for (let i = 1; i <= pdf.numPages; i++) {
        updateProgress(30 + (i * 50 / pdf.numPages));
        
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        
        // Renderizar página como imagem
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Converter para imagem e adicionar ao novo PDF
        const image = await newPdfDoc.embedPng(canvas.toDataURL('image/png'));
        const newPage = newPdfDoc.addPage([image.width, image.height]);
        newPage.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
        });
    }
    
    // Remover metadados
    newPdfDoc.setTitle('Documento Renderizado');
    newPdfDoc.setAuthor('');
    
    return await newPdfDoc.save();
}

// Funções auxiliares
function loadImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        elements.preview.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function loadPdf(file) {
    const blobUrl = URL.createObjectURL(file);
    elements.pdfViewer.src = blobUrl;
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function updateProgress(percent) {
    elements.pdfProgress.style.width = `${percent}%`;
    elements.pdfProgress.textContent = `${percent}%`;
}

// Funções para arrastar e soltar
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
        uploadedFile = file;
        uploadedPdf = null;
        elements.pdfPreviewContainer.classList.add('hidden');
        elements.imagePreviewContainer.classList.remove('hidden');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            elements.imagePreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
        uploadedPdf = file;
        uploadedFile = null;
        elements.imagePreviewContainer.classList.add('hidden');
        elements.pdfPreviewContainer.classList.remove('hidden');
        
        const blobUrl = URL.createObjectURL(file);
        elements.pdfPreview.src = blobUrl;
    }
}

function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            uploadedFile = blob;
            uploadedPdf = null;
            
            elements.pdfPreviewContainer.classList.add('hidden');
            elements.imagePreviewContainer.classList.remove('hidden');
            
            const reader = new FileReader();
            reader.onload = function(event) {
                elements.imagePreview.src = event.target.result;
            };
            reader.readAsDataURL(blob);
            break;
        }
    }
}
// Funções para extração de texto
function extractText() {
    if (!uploadedFile && !uploadedPdf) {
        alert('Por favor, carregue uma imagem ou PDF.');
        return;
    }

    if (uploadedPdf) {
        alert('Para extrair texto de PDFs, por favor carregue uma imagem.');
        return;
    }

    const language = elements.language.value;
    elements.output.innerText = 'Processando...';
    elements.confidenceDetails.innerHTML = '';
    elements.toggleDetailsButton.classList.add('hidden');
    elements.copyButton.classList.add('hidden');

    Tesseract.recognize(
        uploadedFile,
        language,
        { logger: m => console.log(m) }
    ).then(({ data: { text, words } }) => {
        elements.output.innerText = text;
        
        elements.confidenceDetails.innerHTML = words.map(word => `
            <div>
                <strong>${word.text}</strong>: ${(word.confidence * 100).toFixed(2)}% de confiança
            </div>
        `).join('');

        elements.toggleDetailsButton.classList.remove('hidden');
        elements.copyButton.classList.remove('hidden');
    }).catch(err => {
        console.error(err);
        elements.output.innerText = 'Erro ao processar a imagem.';
    });
}

function copyText() {
    navigator.clipboard.writeText(elements.output.innerText)
        .then(() => alert('Texto copiado para a área de transferência!'))
        .catch(err => console.error('Erro ao copiar o texto:', err));
}

function toggleDetails() {
    if (elements.confidenceDetails.style.display === 'none') {
        elements.confidenceDetails.style.display = 'block';
        elements.toggleDetailsButton.innerText = 'Ocultar Detalhes';
    } else {
        elements.confidenceDetails.style.display = 'none';
        elements.toggleDetailsButton.innerText = 'Mostrar Detalhes';
    }
}

