const $ = (id) => document.getElementById(id);

// ============ UPLOAD ============
const dropzone = $('dropzone');
const fileInput = $('fileInput');
const uploadStatus = $('uploadStatus');

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadFile(fileInput.files[0]);
});

async function uploadFile(file) {
    uploadStatus.textContent = `⏳ Đang upload ${file.name}...`;
    uploadStatus.className = 'status';

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch('/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
            uploadStatus.textContent = `✅ ${data.message} (${formatSize(data.size)})`;
            uploadStatus.className = 'status ok';
            loadFiles();
        } else {
            uploadStatus.textContent = `❌ ${data.error}`;
            uploadStatus.className = 'status err';
        }
    } catch (err) {
        uploadStatus.textContent = `❌ Lỗi: ${err.message}`;
        uploadStatus.className = 'status err';
    }
    fileInput.value = '';
}

// ============ FILE LIST ============
async function loadFiles() {
    const list = $('fileList');
    try {
        const res = await fetch('/files');
        const data = await res.json();
        if (!data.files.length) {
            list.innerHTML = '<li class="empty">Chưa có file nào</li>';
            return;
        }
        list.innerHTML = data.files.map(f => `
            <li>
                <div class="fname">
                    <span>📄 ${f.name}</span>
                    <span class="fsize">${formatSize(f.size)}</span>
                </div>
                <div class="actions">
                    <button onclick="downloadFile('${f.name}')">⬇ Tải</button>
                    <button class="del" onclick="deleteFile('${f.name}')">🗑 Xóa</button>
                </div>
            </li>
        `).join('');
    } catch (err) {
        list.innerHTML = `<li class="empty">Lỗi load file: ${err.message}</li>`;
    }
}

async function deleteFile(name) {
    if (!confirm(`Xóa ${name}?`)) return;
    await fetch(`/delete/${encodeURIComponent(name)}`, { method: 'DELETE' });
    loadFiles();
}

function downloadFile(name) {
    window.location.href = `/download/${encodeURIComponent(name)}`;
}

$('refreshFiles').addEventListener('click', loadFiles);

// ============ TERMINAL ============
const terminal = $('terminal');
const cmdInput = $('cmdInput');
const runBtn = $('runCmd');

function appendLine(text, cls = 'out') {
    const div = document.createElement('div');
    div.className = `term-line ${cls}`;
    div.textContent = text;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

async function runCommand() {
    const cmd = cmdInput.value.trim();
    if (!cmd) return;

    appendLine(`$ ${cmd}`, 'cmd');
    cmdInput.value = '';
    runBtn.disabled = true;

    try {
        const res = await fetch('/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cmd })
        });
        const data = await res.json();

        if (data.success) {
            if (data.stdout) appendLine(data.stdout.trimEnd(), 'out');
            if (data.stderr) appendLine(data.stderr.trimEnd(), 'err');
            appendLine(`↳ exit code: ${data.returncode}`, data.returncode === 0 ? 'ok' : 'err');
        } else {
            appendLine(`❌ ${data.error}`, 'err');
        }
    } catch (err) {
        appendLine(`❌ Lỗi mạng: ${err.message}`, 'err');
    }
    runBtn.disabled = false;
    cmdInput.focus();
}

runBtn.addEventListener('click', runCommand);
cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runCommand();
});

// ============ UTILS ============
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Load lần đầu
loadFiles();