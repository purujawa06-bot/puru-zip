# PuruAI React – Client-Side Editor

PuruAI dikonversi ke **React + Vite** tanpa backend. Semua logika berjalan di browser:

- Virtual File System (VFS) in-memory
- ZIP upload/download via **JSZip** (client-side)
- Agent loop langsung memanggil AI API dari browser
- Upload file konteks tersimpan di VFS (`_context_upload/`)

## Cara Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`

## Build Produksi

```bash
npm run build
npm run preview
```

## Perbedaan dari Versi Backend

| Fitur | Backend (Python) | React (Tanpa Backend) |
|---|---|---|
| VFS | File system server | In-memory (RAM) |
| Session | Persisten 3 hari | Hilang saat refresh |
| Curl | Server-side curl | Browser fetch (CORS terbatas) |
| ZIP | Server extract | JSZip client-side |
| Binary upload | Simpan ke disk | Base64 in-memory |

## Catatan

- **Session tidak persisten**: Refresh halaman = data hilang. Selalu download ZIP sebelum menutup browser.
- **Curl / HTTP requests**: Browser membatasi cross-origin requests (CORS). Request ke API yang tidak mengizinkan CORS akan gagal.
- **File besar**: Karena semua di memori, file/ZIP sangat besar mungkin lambat.
