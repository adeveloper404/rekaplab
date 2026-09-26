// Ganti URL endpoint berikut dengan Web App URL Google Apps Script Anda
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwkklclaUlyfQrbvzBm9-PPCGHGk731UjkBy9mem05aT4mRJjXlU2RQtETg4HtBFWLl/exec";

// Master Item Checklist Spesifik Komputer Laboratorium
const LAB_INSPECTION_ITEMS = {
  hardware: [
    "Suhu & Kipas Pendingin Processor (Heatsink Fan)",
    "Kondisi Power Supply Unit (PSU) & Kabel Power",
    "Kesehatan Harddisk / SSD (Bad Sector / SMART)",
    "Kebersihan Motherboard & Debu Casing CPU",
    "Port USB Depan & Belakang"
  ],
  peripheral: [
    "Layar Monitor (Dead Pixel, Garis, Flicker)",
    "Fungsi Keyboard (Semua Tombol Berfungsi)",
    "Fungsi Mouse (Klik Kiri, Kanan, Scroll)",
    "Kabel Display (HDMI / VGA / DisplayPort)"
  ],
  software: [
    "Konektivitas Jaringan LAN & Akses Internet",
    "Sistem Operasi (Aktivasi & Booting Lancar)",
    "Software Praktikum / Lab (Lisensi & Siap Pakai)",
    "Perlindungan Antivirus / DeepFreeze / Rollback"
  ]
};

let inspectionRecords = [];
let compressedPhotoBase64 = "";

document.addEventListener("DOMContentLoaded", () => {
  setupTheme();
  setupTabs();
  buildChecklistUI();
  setInitialDateTime();
  setupPhotoCompression();
  bindFormActions();
  loadStoredRecords();
});

// 1. Theme Toggle
function setupTheme() {
  const btn = document.getElementById("themeToggleBtn");
  const icon = document.getElementById("themeIcon");
  const activeTheme = localStorage.getItem("lab_theme") || "dark";
  document.body.className = activeTheme;
  updateThemeIcon(activeTheme);

  btn.onclick = () => {
    const isDark = document.body.classList.toggle("dark");
    const nextTheme = isDark ? "dark" : "light";
    document.body.className = nextTheme;
    localStorage.setItem("lab_theme", nextTheme);
    updateThemeIcon(nextTheme);
  };

  function updateThemeIcon(t) {
    icon.className = t === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }
}

// 2. Tabs Navigation
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-button");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");

      if (tab.dataset.tab === "tab-cetak") populatePrintDropdown();
    });
  });
}

// 3. Render Checklist Fields Dinamis
function buildChecklistUI() {
  Object.keys(LAB_INSPECTION_ITEMS).forEach(groupKey => {
    const target = document.getElementById(`group-${groupKey}`);
    if (!target) return;

    LAB_INSPECTION_ITEMS[groupKey].forEach((title, idx) => {
      const fieldId = `${groupKey}_${idx}`;
      const row = document.createElement("div");
      row.className = "check-row";
      row.innerHTML = `
        <div class="check-title">${title}</div>
        <div class="choice-pills">
          <label class="pill-option normal active">
            <input type="radio" name="${fieldId}" value="Normal" checked>
            <i class="fa-solid fa-circle-check"></i> Normal
          </label>
          <label class="pill-option trouble">
            <input type="radio" name="${fieldId}" value="Kendala">
            <i class="fa-solid fa-triangle-exclamation"></i> Kendala
          </label>
        </div>
        <input type="text" id="${fieldId}_note" class="sub-note-input hidden" placeholder="Detail kendala / komponen rusak...">
      `;

      const options = row.querySelectorAll(".pill-option");
      const noteInput = row.querySelector(".sub-note-input");

      options.forEach(opt => {
        opt.addEventListener("click", () => {
          options.forEach(o => o.classList.remove("active"));
          opt.classList.add("active");
          const val = opt.querySelector("input").value;
          if (val === "Kendala") {
            noteInput.classList.remove("hidden");
            noteInput.required = true;
          } else {
            noteInput.classList.add("hidden");
            noteInput.required = false;
            noteInput.value = "";
          }
        });
      });

      target.appendChild(row);
    });
  });
}

function setInitialDateTime() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  document.getElementById("auditDate").value = (new Date(d - tzOffset)).toISOString().slice(0, 16);
}

// 4. Kompresi Foto Otomatis (Max Dimension 1280px, Kualitas 0.72)
function setupPhotoCompression() {
  const fileInput = document.getElementById("photoInput");
  const placeholder = document.getElementById("uploadPlaceholder");
  const previewWrapper = document.getElementById("previewWrapper");
  const imgElem = document.getElementById("imagePreview");
  const removeBtn = document.getElementById("btnRemovePhoto");

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxLimit = 1280;
        let w = img.width;
        let h = img.height;

        if (w > h && w > maxLimit) {
          h = Math.round((h * maxLimit) / w);
          w = maxLimit;
        } else if (h > maxLimit) {
          w = Math.round((w * maxLimit) / h);
          h = maxLimit;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        compressedPhotoBase64 = canvas.toDataURL("image/jpeg", 0.72);
        imgElem.src = compressedPhotoBase64;
        placeholder.classList.add("hidden");
        previewWrapper.classList.remove("hidden");
      };
    };
    reader.readAsDataURL(file);
  });

  removeBtn.onclick = (e) => {
    e.stopPropagation();
    fileInput.value = "";
    compressedPhotoBase64 = "";
    previewWrapper.classList.add("hidden");
    placeholder.classList.remove("hidden");
  };
}

// 5. Form Submission & Simpan
function bindFormActions() {
  const form = document.getElementById("auditForm");
  const btn = document.getElementById("btnSaveAudit");

  // Format ID Komputer selalu kapital otomatis
  document.getElementById("pcCode").addEventListener("input", e => {
    e.target.value = e.target.value.toUpperCase();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan ke Cloud...</span>`;

    const detailList = [];
    let overallStatus = "Normal";

    Object.keys(LAB_INSPECTION_ITEMS).forEach(groupKey => {
      LAB_INSPECTION_ITEMS[groupKey].forEach((title, idx) => {
        const fieldId = `${groupKey}_${idx}`;
        const val = form.querySelector(`input[name="${fieldId}"]:checked`).value;
        const note = document.getElementById(`${fieldId}_note`).value;
        if (val === "Kendala") overallStatus = "Kendala / Perlu Servis";

        detailList.push({ item: title, status: val, note });
      });
    });

    const payload = {
      action: "recordPcAudit",
      tanggal_audit: document.getElementById("auditDate").value,
      lab: document.getElementById("labSelect").value,
      pc_code: document.getElementById("pcCode").value,
      inspector: document.getElementById("inspector").value,
      cpu: document.getElementById("cpuSpec").value,
      ram: document.getElementById("ramSpec").value,
      storage: document.getElementById("storageSpec").value,
      overall_status: overallStatus,
      checklist_json: JSON.stringify(detailList),
      foto_base64: compressedPhotoBase64
    };

    try {
      if (GAS_API_URL.includes("YOUR_SCRIPT_ID")) {
        saveLocalRecord(payload);
        alert("Peringatan: URL Apps Script belum diisi. Data tersimpan di memori browser lokal!");
      } else {
        await fetch(GAS_API_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        saveLocalRecord(payload);
        alert("Data audit PC berhasil disimpan dan foto terunggah ke Google Drive!");
      }

      form.reset();
      document.getElementById("btnRemovePhoto").click();
      setInitialDateTime();
      loadStoredRecords();
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat menyimpan data.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span>Simpan Data Audit</span>`;
    }
  });

  // Filter & Search events
  document.getElementById("searchKeyword").addEventListener("input", renderRecordCards);
  document.getElementById("filterLab").addEventListener("change", renderRecordCards);
  document.getElementById("filterStatus").addEventListener("change", renderRecordCards);

  // Modal Close
  document.getElementById("btnCloseModal").onclick = () => {
    document.getElementById("detailModal").classList.add("hidden");
  };

  // Cetak Dokumen
  document.getElementById("btnPrintAction").onclick = () => {
    const idx = document.getElementById("selectPcForPrint").value;
    const item = inspectionRecords[idx];
    if (item) executePrintDocument(item);
  };
}

function saveLocalRecord(data) {
  const records = JSON.parse(localStorage.getItem("labtrack_db") || "[]");
  records.unshift(data);
  localStorage.setItem("labtrack_db", JSON.stringify(records));
}

async function loadStoredRecords() {
  const container = document.getElementById("pcListContainer");
  
  // 1. Tampilkan data dari localStorage dulu (agar tidak blank saat loading)
  inspectionRecords = JSON.parse(localStorage.getItem("labtrack_db") || "[]");
  renderRecordCards();
  updateMetrics();

  // 2. Jika URL Google Script sudah diisi, tarik data cloud terbaru
  if (!GAS_API_URL.includes("YOUR_SCRIPT_ID")) {
    if (container && inspectionRecords.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data dari Google Sheets...</div>`;
    }

    try {
      const response = await fetch(GAS_API_URL);
      const resData = await response.json();

      if (resData.status === "success" && Array.isArray(resData.data)) {
        // Balik urutan agar data terbaru berada di paling atas
        inspectionRecords = resData.data.reverse();
        
        // Simpan cache ke memori lokal
        localStorage.setItem("labtrack_db", JSON.stringify(inspectionRecords));
        
        // Render ulang tampilan dengan data live dari Google Sheets
        renderRecordCards();
        updateMetrics();
      }
    } catch (err) {
      console.warn("Gagal mengambil data live dari Cloud, memakai data lokal:", err);
    }
  }
}

function updateMetrics() {
  const total = inspectionRecords.length;
  const normal = inspectionRecords.filter(r => r.overall_status === "Normal").length;
  const issue = total - normal;

  document.getElementById("metricTotal").innerText = total;
  document.getElementById("metricNormal").innerText = normal;
  document.getElementById("metricIssue").innerText = issue;
}

// 6. Tampilkan Daftar PC & Filter
function renderRecordCards() {
  const q = document.getElementById("searchKeyword").value.toLowerCase();
  const lab = document.getElementById("filterLab").value;
  const status = document.getElementById("filterStatus").value;
  const container = document.getElementById("pcListContainer");
  container.innerHTML = "";

  const results = inspectionRecords.filter(r => {
    const matchQuery = r.pc_code.toLowerCase().includes(q) || 
                       r.lab.toLowerCase().includes(q) || 
                       r.inspector.toLowerCase().includes(q);
    const matchLab = lab === "ALL" || r.lab === lab;
    const matchStatus = status === "ALL" || r.overall_status === status;
    return matchQuery && matchLab && matchStatus;
  });

  if (results.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-secondary); font-size:0.85rem;">Tidak ada unit komputer ditemukan</div>`;
    return;
  }

  results.forEach(item => {
    const card = document.createElement("div");
    card.className = "pc-unit-card";
    const isNormal = item.overall_status === "Normal";

    card.innerHTML = `
      <div>
        <div style="font-weight:700; font-size:0.95rem;">${item.pc_code}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${item.lab}</div>
        <div style="font-size:0.7rem; color:var(--text-secondary);">${item.tanggal_audit.replace("T", " ")}</div>
      </div>
      <div>
        <span class="badge-tag ${isNormal ? 'safe' : 'danger'}">
          ${item.overall_status}
        </span>
      </div>
    `;
    card.onclick = () => showModalDetail(item);
    container.appendChild(card);
  });
}

function showModalDetail(item) {
  const modal = document.getElementById("detailModal");
  document.getElementById("modalPcTitle").innerText = `${item.pc_code} (${item.lab})`;
  const body = document.getElementById("modalDetailBody");

  const checklist = typeof item.checklist_json === "string" ? JSON.parse(item.checklist_json) : item.checklist_json;

  let checksHtml = checklist.map(c => `
    <div style="padding: 7px 0; border-bottom: 1px solid var(--surface-border); font-size:0.8rem;">
      <div style="display:flex; justify-content:space-between;">
        <span>${c.item}</span>
        <strong style="color: ${c.status === 'Normal' ? 'var(--status-safe)' : 'var(--status-danger)'}">${c.status}</strong>
      </div>
      ${c.note ? `<p style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px;">Catatan: ${c.note}</p>` : ''}
    </div>
  `).join("");

  // Deteksi sumber foto (apakah base64 atau link drive)
  const imageSource = item.foto_base64 || item.foto_drive_url;
  let photoElement = "";
  
  if (imageSource) {
    if (imageSource.startsWith("data:image")) {
      photoElement = `<img src="${imageSource}" style="width:100%; border-radius:8px; border:1px solid var(--surface-border);">`;
    } else {
      photoElement = `<div style="margin-top:0.5rem;"><a href="${imageSource}" target="_blank" style="color:var(--accent-cyan); font-size:0.8rem; text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka Foto di Google Drive</a></div>`;
    }
  }

  body.innerHTML = `
    <div style="font-size:0.8rem; line-height: 1.6; margin-bottom: 1rem;">
      <p><strong>Pemeriksa:</strong> ${item.inspector}</p>
      <p><strong>Spesifikasi:</strong> ${item.cpu} | RAM ${item.ram} | ${item.storage}</p>
    </div>
    <div style="max-height:220px; overflow-y:auto;">
      ${checksHtml}
    </div>
    ${photoElement ? `
      <div style="margin-top:1rem;">
        <p style="font-size:0.75rem; font-weight:600; margin-bottom:0.4rem;">Foto Dokumentasi Unit:</p>
        ${photoElement}
      </div>
    ` : ''}
  `;

  modal.classList.remove("hidden");
}

function populatePrintDropdown() {
  const select = document.getElementById("selectPcForPrint");
  select.innerHTML = "";
  inspectionRecords.forEach((r, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.innerText = `${r.pc_code} - ${r.lab} (${r.tanggal_audit.slice(0, 10)})`;
    select.appendChild(opt);
  });
}

// 7. Render Layout Cetak Berita Acara
function executePrintDocument(data) {
  const printArea = document.getElementById("printSheet");
  const checks = typeof data.checklist_json === "string" ? JSON.parse(data.checklist_json) : data.checklist_json;

  const rows = checks.map((c, i) => `
    <tr>
      <td style="text-align:center; width:35px;">${i + 1}</td>
      <td>${c.item}</td>
      <td style="text-align:center; width:100px;">${c.status}</td>
      <td>${c.note || '-'}</td>
    </tr>
  `).join("");

  printArea.innerHTML = `
    <div class="doc-kop">
      <h2 style="margin-bottom: 4px;">BERITA ACARA PEMERIKSAAN KELAYAKAN KOMPUTER</h2>
      <p style="font-size: 11pt;">Laboratorium Komputer & Pusat Teknologi Informasi</p>
    </div>

    <table style="width:100%; margin-bottom: 12px; font-size:10.5pt; border:none;">
      <tr>
        <td style="width: 20%; padding: 3px 0;"><strong>ID Komputer</strong></td>
        <td style="width: 30%;">: ${data.pc_code}</td>
        <td style="width: 20%;"><strong>Tanggal Audit</strong></td>
        <td>: ${data.tanggal_audit.replace("T", " ")}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0;"><strong>Lokasi Lab</strong></td>
        <td>: ${data.lab}</td>
        <td><strong>Teknisi Pemeriksa</strong></td>
        <td>: ${data.inspector}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0;"><strong>Spesifikasi Unit</strong></td>
        <td colspan="3">: ${data.cpu} / RAM ${data.ram} / Storage ${data.storage}</td>
      </tr>
    </table>

    <table class="doc-table">
      <thead>
        <tr>
          <th>No</th>
          <th>Komponen Diperiksa</th>
          <th>Kondisi</th>
          <th>Keterangan Kerusakan / Solusi</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    ${data.foto_base64 ? `
      <div style="margin-top: 15px;">
        <p><strong>Lampiran Foto Fisik Unit:</strong></p>
        <img src="${data.foto_base64}" style="max-height: 180px; border: 1px solid #999; margin-top: 6px;">
      </div>
    ` : ''}

    <div class="doc-sign-box">
      <div class="sign-person">
        <p>Teknisi Laboratorium,</p>
        <br><br><br><br>
        <p><strong>( ${data.inspector} )</strong></p>
      </div>
      <div class="sign-person">
        <p>Kepala Laboratorium Komputer,</p>
        <br><br><br><br>
        <p><strong>( ............................................ )</strong></p>
      </div>
    </div>
  `;

  window.print();
}
