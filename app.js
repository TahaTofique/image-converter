const $ = id => document.getElementById(id);
const formatBytes = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
let image, imageName = 'image', natural = { w: 0, h: 0 }, pdfCanvas, pdfName = 'document';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

document.querySelectorAll('#tools button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#tools .active').classList.remove('active');
  button.classList.add('active');
  document.querySelectorAll('.tool-panel').forEach(panel => panel.classList.add('hidden'));
  $(`${button.dataset.tool}-tool`).classList.remove('hidden');
}));
document.querySelectorAll('.browse').forEach(button => button.addEventListener('click', () => $(button.dataset.file).click()));

function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 15 * 1024 * 1024) return alert('Please choose an image under 15MB.');
  const reader = new FileReader();
  reader.onload = () => {
    image = new Image();
    image.onload = () => {
      natural = { w: image.width, h: image.height };
      imageName = file.name.replace(/\.[^.]+$/, '');
      $('image-preview').src = reader.result;
      $('image-name').textContent = file.name;
      $('image-width').value = image.width;
      $('image-height').value = image.height;
      $('image-meta').textContent = `${image.width} × ${image.height} · ${formatBytes(file.size)}`;
      $('image-drop').classList.add('hidden');
      $('image-editor').classList.remove('hidden');
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function sizedCanvas(format) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Number($('image-width').value) || natural.w);
  canvas.height = Math.max(1, Number($('image-height').value) || natural.h);
  const context = canvas.getContext('2d');
  if (format === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
function syncSize(changed) {
  if (!$('image-lock').checked || !natural.w) return;
  const ratio = natural.w / natural.h;
  if (changed === 'width') $('image-height').value = Math.round($('image-width').value / ratio);
  else $('image-width').value = Math.round($('image-height').value * ratio);
}

$('image-file').addEventListener('change', e => loadImage(e.target.files[0]));
['dragenter', 'dragover'].forEach(event => $('image-drop').addEventListener(event, e => { e.preventDefault(); $('image-drop').classList.add('drag'); }));
['dragleave', 'drop'].forEach(event => $('image-drop').addEventListener(event, e => { e.preventDefault(); $('image-drop').classList.remove('drag'); }));
$('image-drop').addEventListener('drop', e => loadImage(e.dataTransfer.files[0]));
$('image-width').addEventListener('input', () => syncSize('width'));
$('image-height').addEventListener('input', () => syncSize('height'));
$('image-quality').addEventListener('input', () => $('image-quality-value').value = `${$('image-quality').value}%`);
$('image-download').addEventListener('click', () => {
  if (!image) return;
  const format = $('image-format').value;
  const canvas = sizedCanvas(format);
  if (format === 'pdf') {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${imageName}.pdf`);
    return;
  }
  const link = document.createElement('a');
  link.href = canvas.toDataURL(format, Number($('image-quality').value) / 100);
  link.download = `${imageName}-converted.${format.split('/')[1].replace('jpeg', 'jpg')}`;
  link.click();
});

async function loadPdf(file) {
  if (!file) return;
  try {
    pdfName = file.name.replace(/\.pdf$/i, '');
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.6 });
    pdfCanvas = $('pdf-preview');
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise;
    $('pdf-name').textContent = file.name;
    $('pdf-meta').textContent = `${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'} · exporting page 1`;
    $('pdf-drop').classList.add('hidden');
    $('pdf-editor').classList.remove('hidden');
  } catch { alert('This PDF could not be opened. Please try another file.'); }
}
$('pdf-file').addEventListener('change', e => loadPdf(e.target.files[0]));
['dragenter', 'dragover'].forEach(event => $('pdf-drop').addEventListener(event, e => { e.preventDefault(); $('pdf-drop').classList.add('drag'); }));
['dragleave', 'drop'].forEach(event => $('pdf-drop').addEventListener(event, e => { e.preventDefault(); $('pdf-drop').classList.remove('drag'); }));
$('pdf-drop').addEventListener('drop', e => loadPdf(e.dataTransfer.files[0]));
$('pdf-quality').addEventListener('input', () => $('pdf-quality-value').value = `${$('pdf-quality').value}%`);
$('pdf-download').addEventListener('click', () => {
  if (!pdfCanvas) return;
  const type = $('pdf-format').value;
  const link = document.createElement('a');
  link.href = pdfCanvas.toDataURL(type, Number($('pdf-quality').value) / 100);
  link.download = `${pdfName}-page-1.${type.split('/')[1].replace('jpeg', 'jpg')}`;
  link.click();
});

function detect(text) { return $('code-type').value !== 'auto' ? $('code-type').value : text.trim().startsWith('<') ? 'xml' : 'json'; }
function formatXml(text) { const lines = text.replace(/>(\s*)</g, '><').replace(/></g, '>\n<').split('\n'); let depth = 0; return lines.map(line => { if (/^<\//.test(line)) depth--; const result = '  '.repeat(Math.max(0, depth)) + line; if (/^<[^!?/][^>]*[^/]?>$/.test(line) && !line.includes('</')) depth++; return result; }).join('\n'); }
function clean(action) { const input = $('code-input'), text = input.value.trim(); if (!text) return; try { const type = detect(text); if (type === 'json') { const value = JSON.parse(text); input.value = action === 'format' ? JSON.stringify(value, null, 2) : JSON.stringify(value); } else { if (new DOMParser().parseFromString(text, 'application/xml').querySelector('parsererror')) throw Error('Invalid XML'); input.value = action === 'format' ? formatXml(text) : text.replace(/>\s+</g, '><').trim(); } $('code-status').textContent = `${type.toUpperCase()} ${action === 'format' ? 'formatted' : 'minified'} successfully.`; } catch (error) { $('code-status').textContent = `Could not process this file: ${error.message}`; } }
$('format').onclick = () => clean('format'); $('minify').onclick = () => clean('minify');
$('code-file').onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { $('code-input').value = reader.result; $('code-status').textContent = `Loaded ${file.name}`; }; reader.readAsText(file); };
$('code-download').onclick = () => { const text = $('code-input').value; if (!text) return; const type = detect(text); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type: type === 'xml' ? 'application/xml' : 'application/json' })); link.download = `cleaned-file.${type}`; link.click(); URL.revokeObjectURL(link.href); };
